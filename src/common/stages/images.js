import axios from 'axios';
import { resolve } from 'bluebird';
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { convert } from 'imagemagick';
import cv from 'opencv4nodejs';
import { basename, join } from 'path';

import { error, log } from '../../renderer/Log';
import { tmpPath } from '../constants';
import { emptyMat, getMatchedTemplates, loadImage, measureTemplate, timeSignatures } from '../opencv';

const imageDir = join(tmpPath, 'images');

export function downloadImages(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      if (!existsSync(imageDir)) mkdirSync(imageDir);

      const imgs = data.images.map((i) => {
        return new Promise((resolve, reject) => {
          const file = join(imageDir, `${data.id}_${basename(i)}`);
          if (existsSync(file)) {
            resolve();
            return;
          }

          axios
            .get(i, { responseType: 'arraybuffer' })
            .then((res) => {
              writeFileSync(file, Buffer.from(res.data));

              const args = [file, '-background', 'white', '-flatten', file];
              convert(args, (err, stdout) => {
                if (err) rejectMain(err);
                resolve();
              });
            })
            .catch((err) => {
              rejectMain(err);
            });
        });
      });

      await Promise.all(imgs);

      const combined = join(imageDir, `${data.id}_output.png`);
      if (existsSync(combined)) unlinkSync(combined);
      const files = readdirSync(imageDir)
        .filter(
          (p) =>
            p.indexOf(data.id) !== -1 &&
            p.indexOf('output') === -1 &&
            p.indexOf('measure') === -1 &&
            p.indexOf('row') === -1 &&
            p.indexOf('final') === -1
        )
        .map((f) => join(imageDir, f))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

      await new Promise((resolve, reject) => {
        convert([...files, '+append', combined], (err, stdout) => {
          if (err) rejectMain(err);
          resolve();
        });
      });

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

let combined, measures, rows, timeSigMat;
const maxWidth = 3500;

export function matchImages(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      combined = loadImage(join(imageDir, `${data.id}_output.png`));

      const match = combined.copy();
      const matchedMeasures = getMatchedTemplates(match, { measure: measureTemplate }, true);
      const timeSigMatch = getMatchedTemplates(match, timeSignatures);

      if (Object.entries(timeSigMatch).length === 0) throw 'Could not find time signature';

      const timeSig = Object.entries(timeSigMatch)[0];
      const rect = new cv.Rect(0, 0, timeSig[1].x + timeSignatures[timeSig[0]].mat.cols, combined.rows);
      timeSigMat = combined.getRegion(rect).copy();

      const matched = matchedMeasures.measure.sort((a, b) => a.x - b.x);
      measures = [];
      for (let i = 1; i < matched.length; i++) {
        const left = i === 1 ? 0 : matched[i - 1].x;
        const right = i === matched.length - 1 ? combined.cols : matched[i].x;

        const m = combined.getRegion(new cv.Rect(left, 0, right - left, combined.rows));
        measures.push(m);
      }

      if (measures.length === 0) throw 'Could not find measures';

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export function generateRows(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      const makeCurrent = (addTimeSig) => {
        let current = emptyMat(combined.rows, maxWidth);

        if (addTimeSig) {
          timeSigMat.copyTo(current.getRegion(new cv.Rect(0, 0, timeSigMat.cols, current.rows)));
          width += timeSigMat.cols;
        }

        return current;
      };

      let width = 0;
      rows = [];
      let current = makeCurrent();

      for (let i = 0; i < measures.length; i++) {
        const measure = measures[i];
        if (width + measure.cols > maxWidth) {
          rows.push(current);

          width = 0;
          current = makeCurrent(true);
        }

        // console.log(i, 'copying', width, rows.length);
        measure.copyTo(current.getRegion(new cv.Rect(width, 0, measure.cols, current.rows)));
        width += measure.cols;
      }
      rows.push(current);

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export function finalImage(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      const rowHeight = combined.rows + 100;
      const height = rows.length * rowHeight;
      const final = emptyMat(height, maxWidth);

      for (let i = 0; i < rows.length; i++) {
        const rect = new cv.Rect(0, i * rowHeight, maxWidth, combined.rows);
        // console.log(final.cols, final.rows, rect);
        rows[i].copyTo(final.getRegion(rect));
      }

      // TODO: Replace all non-standard ascii chars
      const title = data.title.replace(/[^\x00-\x7F]/g, '');

      const finalFile = join(imageDir, `${title}.png`);
      cv.imwrite(finalFile, final);

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}
