import axios from 'axios';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import cv from 'opencv4nodejs';
import { basename, join } from 'path';

import { tmpPath, writeFileAsync } from '../constants';
import { emptyMat, flatten, getMatchedTemplates, loadImage, loadImageAsync, measureTemplate, timeSignatures } from '../opencv';

export const imageDir = join(tmpPath, 'images');

export function downloadImages(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      if (!existsSync(imageDir)) mkdirSync(imageDir);

      // Download each image from the data
      const imgs = data.images.map((image, i) => {
        return new Promise((resolve, reject) => {
          const file = join(imageDir, `${data.id}_${basename(image)}`);
          if (existsSync(file)) {
            resolve();
            return;
          }

          axios
            .get(image, { responseType: 'arraybuffer' })
            .then(async (res) => {
              await writeFileAsync(file, Buffer.from(res.data));

              const img = await loadImageAsync(file, true);
              const flat = flatten(img);

              await cv.imwriteAsync(file, flat);
              resolve();
            })
            .catch((err) => {
              rejectMain(err);
            });
        });
      });

      // Wait to download all images
      await Promise.all(imgs);

      // Combine all images into a single long strip
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

      // Load all images and compute end size
      let maxHeight = 0;
      let width = 0;
      const mats = files.map((f) => {
        const img = loadImage(f);
        width += img.cols;
        maxHeight = Math.max(img.rows, maxHeight);
        return img;
      });

      // Combine and save file
      const combinedMat = emptyMat(maxHeight, width);

      let w = 0;
      for (let i = 0; i < mats.length; i++) {
        await mats[i].copyToAsync(combinedMat.getRegion(new cv.Rect(w, 0, mats[i].cols, mats[i].rows)));
        w += mats[i].cols;
      }

      await cv.imwriteAsync(combined, combinedMat);

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
      const matchedMeasures = await getMatchedTemplates(match, { measure: measureTemplate }, true);
      const timeSigMatch = await getMatchedTemplates(match, timeSignatures);

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
      const makeCurrent = async (addTimeSig) => {
        let current = emptyMat(combined.rows, maxWidth);

        if (addTimeSig) {
          await timeSigMat.copyToAsync(current.getRegion(new cv.Rect(0, 0, timeSigMat.cols, current.rows)));
          width += timeSigMat.cols;
        }

        return current;
      };

      let width = 0;
      rows = [];
      let current = await makeCurrent();

      for (let i = 0; i < measures.length; i++) {
        const measure = measures[i];
        if (width + measure.cols > maxWidth) {
          rows.push(current);

          width = 0;
          current = await makeCurrent(true);
        }

        // console.log(i, 'copying', width, rows.length);
        await measure.copyToAsync(current.getRegion(new cv.Rect(width, 0, measure.cols, current.rows)));
        width += measure.cols;
      }
      rows.push(current);

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export function getTitle(data) {
  return data.title.replace(/[^\x00-\x7F]/g, '');
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
        await rows[i].copyToAsync(final.getRegion(rect));
      }

      const title = getTitle(data);
      const finalFile = join(imageDir, `${title}.png`);
      cv.imwriteAsync(finalFile, final);

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}
