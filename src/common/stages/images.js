import axios from 'axios';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import Jimp from 'jimp';
import { jsPDF } from 'jspdf';
import cv from 'opencv4js';
import { basename, join } from 'path';

import { isDevelopment, tmpPath, writeFileAsync } from '../constants';
import { emptyMat, flatten, getMatchedTemplates, loadImage, measureTemplate, timeSignatures } from '../opencv';
import { getTitle } from '../util';

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

              const img = await loadImage(file, true);
              const flat = flatten(img);

              await new Jimp({
                width: flat.cols,
                height: flat.rows,
                data: Buffer.from(flat.data),
              }).writeAsync(file);

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

      const mats = [];
      const regions = [];

      for (const f of files) {
        let img = await loadImage(f);
        mats.push(img);

        regions.push(new cv.Rect(width, 0, img.cols, img.rows));

        width += img.cols;
        maxHeight = Math.max(img.rows, maxHeight);
      }

      // Combine and save file
      let combinedMat = emptyMat(maxHeight, width);

      for (let i = 0; i < mats.length; i++) {
        mats[i].copyTo(combinedMat.roi(regions[i]));
      }

      await new Jimp({
        width: combinedMat.cols,
        height: combinedMat.rows,
        data: Buffer.from(combinedMat.data),
      }).writeAsync(combined);

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
      combined = await loadImage(join(imageDir, `${data.id}_output.png`));
      const result = combined.clone();

      // Find the time signature
      const timeSigRoi = combined.roi(new cv.Rect(0, 0, 400, combined.rows));
      const timeSigMatches = await getMatchedTemplates(timeSigRoi, timeSignatures, result);

      let timeRect;
      Object.entries(timeSigMatches).forEach((e) => {
        const key = e[0];
        const matches = e[1];
        if (!timeRect && matches.length > 0) timeRect = new cv.Rect(0, 0, matches[0].x + timeSignatures[key].mat.cols, combined.rows);
      });

      if (!timeRect) throw 'Could not find time signature';
      timeSigMat = combined.roi(timeRect).clone();

      // Find the measures in the combined image
      const matchedMeasures = await getMatchedTemplates(combined, { measure: measureTemplate }, result);

      // Sort measures and generate matrix regions to use in generateRows
      const sorted = matchedMeasures.measure.sort((a, b) => a.x - b.x);
      measures = [];
      for (let i = 1; i < sorted.length; i++) {
        const left = i === 1 ? 0 : sorted[i - 1].x;
        const right = i === sorted.length - 1 ? combined.cols : sorted[i].x;

        const m = combined.roi(new cv.Rect(left, 0, right - left, combined.rows));
        measures.push(m);
      }

      if (isDevelopment && false) {
        cv.imshow('test', result);
        console.log(matchedMeasures);
        console.log(measures);
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
      const makeCurrent = async (timeSig) => {
        let current = emptyMat(combined.rows, maxWidth);

        if (timeSig) {
          timeSig.copyTo(current.roi(new cv.Rect(0, 0, timeSig.cols, current.rows)));
          width += timeSig.cols;
        }

        return current;
      };

      let width = 0;
      rows = [];
      let current = await makeCurrent();

      let lastTimeSig = timeSigMat.clone();
      const baseTimeSigMatches = await getMatchedTemplates(timeSigMat, timeSignatures, undefined, true);

      for (let i = 0; i < measures.length; i++) {
        const measure = measures[i];
        if (width + measure.cols > maxWidth) {
          // Add row to the list to merge at the end
          rows.push(current);

          // Find if the time signature changed in the current row, if so change for next row
          const timeSigMatches = await getMatchedTemplates(current, timeSignatures);
          let finalRowSig = { key: undefined, x: -1 };
          Object.entries(timeSigMatches).forEach((e) => {
            const key = e[0];
            const matches = e[1];
            if (matches.length > 0) {
              matches.forEach((m) => {
                // Only keep track of changes that are not part of the beginning of the line and take the right-most value
                if (m.x > finalRowSig.x && m.x > lastTimeSig.cols) {
                  finalRowSig.x = m.x;
                  finalRowSig.key = key;
                }
              });
            }
          });

          // If a time sig changed, copy it to the next row
          if (finalRowSig.key) {
            lastTimeSig = timeSigMat.clone();

            const newSig = timeSignatures[finalRowSig.key].mat;

            Object.entries(baseTimeSigMatches).forEach((e) => {
              const matches = e[1];

              matches.forEach((m) => {
                newSig.copyTo(
                  lastTimeSig.roi(
                    new cv.Rect(
                      Math.min(m.x, lastTimeSig.cols - newSig.cols),
                      Math.min(m.y, lastTimeSig.rows - newSig.rows),
                      newSig.cols,
                      newSig.rows
                    )
                  )
                );
              });
            });
          }

          // Start next row
          width = 0;
          current = await makeCurrent(lastTimeSig);
        }

        // console.log(i, 'copying', width, rows.length);

        if (measure.cols > maxWidth) {
          console.error(i, 'copying', width, rows.length);
          console.error('dest', width, 0, measure.cols, current.rows);

          throw 'Cannot copy region larger than maxWidth';
        }

        measure.copyTo(current.roi(new cv.Rect(width, 0, measure.cols, current.rows)));
        width += measure.cols;
      }
      rows.push(current);

      if (isDevelopment && false) rows.forEach((r, i) => cv.imshow(`test${i}`, r));

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export function finalImages(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      const margin = 100;
      const rowHeight = combined.rows + 100;

      const pageRows = 6;
      const pageHeight = pageRows * rowHeight;
      const pages = Math.ceil(rows.length / pageRows);

      for (let p = 0; p < pages; p++) {
        const finalPage = emptyMat(pageHeight + margin, maxWidth + margin);

        for (let i = p * pageRows; i < Math.min((p + 1) * pageRows, rows.length); i++) {
          const rect = new cv.Rect(0, (i % pageRows) * rowHeight + margin, maxWidth, combined.rows);
          // console.log(final.cols, final.rows, rect);
          rows[i].copyTo(finalPage.roi(rect));
        }

        const title = getTitle(data);
        const finalFile = join(imageDir, `${title}_${p}.png`);

        await new Jimp({
          width: finalPage.cols,
          height: finalPage.rows,
          data: Buffer.from(finalPage.data),
        }).writeAsync(finalFile);
      }

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export async function generateScore(data) {
  const doc = new jsPDF({ orientation: 'p', unit: 'px', hotfixes: ['px_scaling'] });

  const title = getTitle(data);
  let p = 0;

  while (true) {
    const page = join(imageDir, `${title}_${p}.png`);
    if (existsSync(page)) {
      const img = await Jimp.read(page);
      const base64Img = await img.getBase64Async(Jimp.AUTO);

      if (p > 0) doc.addPage();

      const scale = 96 / 300; // since we are using 96dpi but audiveris thinks it is 300dpi
      const imgWidth = img.getWidth() * scale;
      const imgHeight = img.getHeight() * scale;

      // console.log(page, imgWidth, imgHeight);

      // Setting page 1 is trickier, others are ok but just keep consistent
      doc.internal.pageSize.setWidth(imgWidth);
      doc.internal.pageSize.setHeight(imgHeight);

      doc.addImage(base64Img, 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      break;
    }

    p++;
  }

  const file = join(imageDir, `${title}.pdf`);
  const pdf = doc.output('arraybuffer');
  await writeFileAsync(file, Buffer.from(pdf));
}
