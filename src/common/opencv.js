import Jimp from 'jimp';
import { join } from 'path';
import cv from 'opencv4js';
import { isDevelopment } from './constants';

const DEBUG = true && isDevelopment;

export let measureTemplate = {};
export let timeSignatures = {};

const measureSizes = [0.9, 0.95, 1, 1.05, 1.1];

export async function initTemplates() {
  measureTemplate = {
    mat: [
      ...(await generateVariations(join(__static, 'templates/measure/measure-1.png'), measureSizes)),
      ...(await generateVariations(join(__static, 'templates/measure/measure-2.png'), measureSizes)),
    ],
    thresh: 0.25,
  };

  timeSignatures = {
    time_3_4: { mat: await loadImage(join(__static, 'templates/time-sig/3-4.png')), thresh: 0.2 },
    time_4_4: { mat: await loadImage(join(__static, 'templates/time-sig/4-4.png')), thresh: 0.2 },
    time_6_8: { mat: await loadImage(join(__static, 'templates/time-sig/6-8.png')), thresh: 0.2 },
  };
}
export async function generateVariations(path, sizes) {
  const img = await Jimp.read(path);
  const variations = [];

  for (const s of sizes) {
    const resized = img.clone().scale(s);
    variations.push(cv.matFromImageData(resized.bitmap));
  }

  return variations;
}

export function scale(m, sx, sy) {
  return m.resize(Math.floor(m.rows * sx), Math.floor(m.cols * (sy || sx)));
}

export async function loadImage(p, alpha) {
  const img = await Jimp.read(p);
  return cv.matFromImageData(img.bitmap);
}

export function showImage(mat) {
  if (DEBUG) cv.imshow('window', mat);
  if (DEBUG) cv.waitKey();
}

export function emptyMat(rows, cols, color) {
  return new cv.Mat(rows, cols, cv.CV_8UC4, color || new cv.Scalar(255, 255, 255, 255));
}

export function flatten(mat) {
  const imageData = mat.data;

  // For some reason I can't make the entire array at once - dumb js
  const transformedImageData = [];

  for (let i = 0; i < mat.rows * mat.cols; i++) {
    // Handle fully transparent image oddity (only 1 channel instead of 4)
    if (imageData.length === mat.rows * mat.cols) {
      transformedImageData[i * 3 + 0] = 255;
      transformedImageData[i * 3 + 1] = 255;
      transformedImageData[i * 3 + 2] = 255;
    } else {
      // "Standard" blending of alpha against white background
      const floatAlpha = imageData[i * 4 + 3] / 255;
      const oneMinus = 1 - floatAlpha;

      transformedImageData[i * 3] = imageData[i * 4] * floatAlpha + oneMinus * 255;
      transformedImageData[i * 3 + 1] = imageData[i * 4 + 1] * floatAlpha + oneMinus * 255;
      transformedImageData[i * 3 + 2] = imageData[i * 4 + 2] * floatAlpha + oneMinus * 255;
    }
  }

  return new cv.matFromArray(mat.rows, mat.cols, cv.CV_8UC4, transformedImageData);
}

export async function copyRegions(srcs, dst, regions) {
  if (dst.type() !== cv.CV_8UC4) throw 'copyRegions only works with 4 channels';

  // Copy each region to the dst array (this array seems to be a clone of the data and so we need to make a new Mat at the end)

  let counter = 0;
  for (let i = 0; i < regions.length; i++) {
    if (srcs[i].type() !== cv.CV_8UC4) throw 'copyRegions only works with 4 channels';

    const src = srcs[i];
    const r = regions[i];

    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        counter++;
        if (counter === 100000) {
          counter = 0;
          // Make this feel a bit more async (the loading spinner doesn't freeze)
          await new Promise((resolve, reject) => setTimeout(resolve, 0));
        }

        const dstIndex = x + r.x + (y + r.y) * dst.cols;
        const srcIndex = x + y * src.cols;

        dst.data[dstIndex * 4] = src.data[srcIndex * 4];
        dst.data[dstIndex * 4 + 1] = src.data[srcIndex * 4 + 1];
        dst.data[dstIndex * 4 + 2] = src.data[srcIndex * 4 + 2];

        // For now ignoring the alpha channel (since it isn't being used anyways)
        // dst.data[dstIndex * 4 + 3] = src.data[srcIndex * 4 + 3];
      }
    }
  }

  return new cv.matFromArray(dst.rows, dst.cols, cv.CV_8UC4, dst.data);
}

export function getMatchedTemplates(mat, templates, multi) {
  return new Promise(async (resolve, reject) => {
    const matches = {};
    const pristine = mat.clone();

    for (const template of Object.entries(templates)) {
      const name = template[0];
      const value = template[1];

      const templates = Array.isArray(value.mat) ? value.mat : [value.mat];

      for (const t of templates) {
        const match = await pristine.matchTemplateAsync(t, cv.TM_CCOEFF_NORMED);

        if (!multi) {
          const minMax = match.minMaxLoc();
          // if (DEBUG) console.log(name, minMax);

          if (minMax.maxVal > 1 - value.thresh) {
            matches[name] = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };

            if (DEBUG) {
              // console.log(name, minMax);
              cv.rectangle(
                mat,
                new cv.Point(minMax.maxLoc.x, minMax.maxLoc.y),
                new cv.Point(minMax.maxLoc.x + t.cols, minMax.maxLoc.y + t.rows),
                new cv.Scalar(255, 0, 0, 255),
                2,
                cv.LINE_8
              );
            }
          }
        } else {
          const dataList = match.getDataAsArray();
          if (!matches[name]) matches[name] = [];

          const tmpMatches = [];
          for (let y = 0; y < dataList.length; y++) {
            for (let x = 0; x < dataList[y].length; x++) {
              if (dataList[y][x] > 1 - value.thresh) {
                tmpMatches.push({ x, y });
              }
            }
          }

          // Filter out duplicates
          const filteredResults = [...matches[name]];
          tmpMatches.forEach((m) => {
            let duplicate = false;
            filteredResults.forEach((f) => {
              if (Math.abs(m.x - f.x) < 50) duplicate = true;
            });
            if (!duplicate) {
              filteredResults.push(m);

              if (DEBUG) {
                // console.log(name, m);
                cv.rectangle(
                  mat,
                  new cv.Point(m.x, m.y),
                  new cv.Point(m.x + t.cols, m.y + t.rows),
                  new cv.Scalar(color[0], color[1], color[2], 255),
                  2,
                  cv.LINE_8
                );
              }
            }
          });

          matches[name] = filteredResults;
        }
      }
    }

    resolve(matches);
  });
}
