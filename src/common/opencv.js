import Jimp from 'jimp';
import { join } from 'path';
import cv from 'opencv4js';
import { isDevelopment } from './constants';

const DEBUG = true && isDevelopment;

export let measureTemplate = {};
export let timeSignatures = {};

const measureSizes = [0.93, 1, 1.07];

const colors = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 0],
];

export async function initTemplates() {
  measureTemplate = {
    mat: [
      // ...(await generateVariations(join(__static, 'templates/measure/measure-1.png'), measureSizes)),
      // ...(await generateVariations(join(__static, 'templates/measure/measure-2.png'), measureSizes)),
      await loadImage(join(__static, 'templates/measure/measure-1.png')),
      await loadImage(join(__static, 'templates/measure/measure-2.png')),
    ],
    thresh: 0.225,
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

export function getMatchedTemplates_OLDCODE(mat, templates, multi) {
  return new Promise(async (resolve, reject) => {
    const matches = {};
    const pristine = mat.clone();

    console.log(templates);

    for (const template of Object.entries(templates)) {
      const name = template[0];
      const value = template[1];

      console.log(name);

      const templates = Array.isArray(value.mat) ? value.mat : [value.mat];

      const match = new cv.Mat(mat.rows, mat.cols);
      for (const t of templates) {
        console.log(t);

        cv.matchTemplate(pristine, t, match, cv.TM_CCOEFF_NORMED);

        console.log(t, 'done matching');

        if (!multi) {
          const minMax = cv.minMaxLoc(match);
          if (DEBUG) console.log(name, minMax);

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
          if (!matches[name]) matches[name] = [];

          const tmpMatches = [];

          // const thresh = new cv.Mat();
          // cv.threshold(match, thresh, 255 * (1 - value.thresh), 255, cv.THRESH_BINARY);

          console.log(match.type(), match.cols, match.rows, match.data.length);

          // Only consider matches in the top 1/3 of the image (we always look for top left corner of match)
          for (let i = 0; i < match.data.length / 3; i += 4) {
            if (match.data[i] > 1 - value.thresh) {
              const x = i % match.cols;
              const y = Math.floor(i / match.rows);

              tmpMatches.push({ x, y });
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
                console.log(name, m);
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

          cv.imshow('test', mat);
          debugger;

          matches[name] = filteredResults;
        }
      }
    }

    console.log(matches);

    resolve(matches);
  });
}

// NEW TEMPLATE CODE
export function getMatchedTemplates(src, templates, result) {
  return new Promise(async (resolve, reject) => {
    const matches = {};
    let colorIndex = 0;

    for (const template of Object.entries(templates)) {
      const name = template[0];
      const value = template[1];

      const templates = Array.isArray(value.mat) ? value.mat : [value.mat];

      for (const temp of templates) {
        colorIndex++;

        if (!matches[name]) matches[name] = [];

        // Find matches with template matching
        const matched = new cv.Mat();
        cv.matchTemplate(src, temp, matched, cv.TM_CCOEFF_NORMED);

        // Find matched areas above the threshold
        cv.threshold(matched, matched, 1 - value.thresh, 1, cv.THRESH_BINARY);
        matched.convertTo(matched, cv.CV_8UC1);

        // Find the coordinates of matched areas
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(matched, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // Filter out duplicates
        const filtered = [...matches[name]];
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i).data32S; // Contains the points

          let duplicate = false;
          filtered.forEach((f) => {
            if (Math.abs(contour[0] - f.x) < 50) duplicate = true;
          });

          if (!duplicate) filtered.push({ x: contour[0], y: contour[1] });
        }

        console.log(name, filtered);

        // Optionally draw results
        if (result) {
          for (let i = 0; i < filtered.length; i++) {
            let x = filtered[i].x;
            let y = filtered[i].y;

            const c = colors[(colorIndex || 0) % colors.length];
            let color = new cv.Scalar(c[0], c[1], c[2], 255);
            let pointA = new cv.Point(x, y);
            let pointB = new cv.Point(x + temp.cols, y + temp.rows);
            cv.rectangle(result, pointA, pointB, color, 2, cv.LINE_8, 0);
          }
        }

        matches[name] = filtered;
      }
    }

    console.log(matches);

    resolve(matches);
  });
}
