import Jimp from 'jimp';
import { join } from 'path';
import cv from 'opencv4js';

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
    thresh: 0.25,
  };

  timeSignatures = {
    time_2_4: { mat: await loadImage(join(__static, 'templates/time-sig/2-4.png')), thresh: 0.2 },
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

export function emptyMat(rows, cols, color) {
  return new cv.Mat(rows, cols, cv.CV_8UC4, color || new cv.Scalar(255, 255, 255, 255));
}

export function flatten(mat) {
  const imageData = mat.data;

  // For some reason I can't initialize the entire array - dumb js
  const transformedImageData = [];

  for (let i = 0; i < mat.rows * mat.cols; i++) {
    // Handle fully transparent image oddity (only 1 channel instead of 4)
    if (imageData.length === mat.rows * mat.cols) {
      transformedImageData[i * 4 + 0] = 255;
      transformedImageData[i * 4 + 1] = 255;
      transformedImageData[i * 4 + 2] = 255;
      transformedImageData[i * 4 + 3] = 255;
    } else {
      // "Standard" blending of alpha against white background
      const floatAlpha = imageData[i * 4 + 3] / 255;
      const oneMinus = 1 - floatAlpha;

      transformedImageData[i * 4] = imageData[i * 4] * floatAlpha + oneMinus * 255;
      transformedImageData[i * 4 + 1] = imageData[i * 4 + 1] * floatAlpha + oneMinus * 255;
      transformedImageData[i * 4 + 2] = imageData[i * 4 + 2] * floatAlpha + oneMinus * 255;
      transformedImageData[i * 4 + 3] = 255;
    }
  }

  return new cv.matFromArray(mat.rows, mat.cols, cv.CV_8UC4, transformedImageData);
}

export function getMatchedTemplates(src, templates, result, checkVertical) {
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
            if (checkVertical) {
              if (Math.abs(contour[0] - f.x) < 50 && Math.abs(contour[1] - f.y) < 50) duplicate = true;
            } else if (Math.abs(contour[0] - f.x) < 50) duplicate = true;
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
