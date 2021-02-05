import cv from 'opencv4nodejs';
import { join } from 'path';

const DEBUG = false;

export const measureTemplate = {
  mat: [
    loadImage(join(__static, 'templates/measure/measure-1.png')),
    scale(loadImage(join(__static, 'templates/measure/measure-1.png')), 0.9),
    scale(loadImage(join(__static, 'templates/measure/measure-1.png')), 0.95),
    scale(loadImage(join(__static, 'templates/measure/measure-1.png')), 1.05),
    scale(loadImage(join(__static, 'templates/measure/measure-1.png')), 1.1),

    loadImage(join(__static, 'templates/measure/measure-2.png')),
    scale(loadImage(join(__static, 'templates/measure/measure-2.png')), 0.9),
    scale(loadImage(join(__static, 'templates/measure/measure-2.png')), 0.95),
    scale(loadImage(join(__static, 'templates/measure/measure-2.png')), 1.05),
    scale(loadImage(join(__static, 'templates/measure/measure-2.png')), 1.1),
  ],
  thresh: 0.25,
};

export const timeSignatures = {
  time_3_4: { mat: loadImage(join(__static, 'templates/time-sig/3-4.png')), thresh: 0.2 },
  time_4_4: { mat: loadImage(join(__static, 'templates/time-sig/4-4.png')), thresh: 0.2 },
  time_6_8: { mat: loadImage(join(__static, 'templates/time-sig/6-8.png')), thresh: 0.2 },
};

export function scale(m, sx, sy) {
  return m.copy().resize(Math.floor(m.rows * sx), Math.floor(m.cols * (sy || sx)));
}

export function loadImage(p, alpha) {
  if (alpha) return cv.imread(p, -1);
  else return cv.imread(p);
}

export function loadImageAsync(p, alpha) {
  if (alpha) return cv.imreadAsync(p, -1);
  else return cv.imreadAsync(p);
}

export function showImage(mat) {
  if (DEBUG) cv.imshow('window', mat);
  if (DEBUG) cv.waitKey();
}

export function emptyMat(rows, cols) {
  const mat = new cv.Mat(rows, cols, cv.CV_8UC3);
  mat.drawRectangle(new cv.Rect(0, 0, cols, rows), new cv.Vec3(255, 255, 255), -1);

  return mat;
}

export function flatten(mat) {
  const imageData = mat.getData();
  const transformedImageData = Array.from(new Array(mat.rows), () => []);

  // Handle fully transparent image oddity (only 1 channel instead of 4)
  let increment = imageData.length === mat.rows * mat.cols ? 1 : 4;

  for (let i = 0; i < imageData.length; i += increment) {
    const row = Math.floor(i / increment / mat.cols);

    if (increment === 1) transformedImageData[row].push([255, 255, 255]);
    else {
      // "Standard" blending of alpha against white background
      const floatAlpha = imageData[i + 3] / 255;
      const oneMinus = 1 - floatAlpha;

      transformedImageData[row].push([
        Math.floor(imageData[i] * floatAlpha + oneMinus * 255),
        Math.floor(imageData[i + 1] * floatAlpha + oneMinus * 255),
        Math.floor(imageData[i + 2] * floatAlpha + oneMinus * 255),
      ]);
    }
  }

  return new cv.Mat(transformedImageData, cv.CV_8UC3);
}

export function getMatchedTemplates(mat, templates, multi) {
  return new Promise(async (resolve, reject) => {
    const matches = {};
    const pristine = mat.copy();

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
              mat.drawRectangle(new cv.Rect(minMax.maxLoc.x, minMax.maxLoc.y, t.cols, t.rows), new cv.Vec3(255, 0, 0), 2, cv.LINE_8);
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
                mat.drawRectangle(new cv.Rect(m.x, m.y, t.cols, t.rows), new cv.Vec3(color[0], color[1], color[2]), 2, cv.LINE_8);
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
