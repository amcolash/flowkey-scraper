import { mkdir } from 'fs/promises';
import { Bitmap, Jimp, JimpInstance } from 'jimp';
import { cv } from 'opencv-wasm';
import { join, relative } from 'path';

import { Note, NoteDuration, NoteEvent, Octave, Song } from './types';
import { getNoteDir, getNoteFile } from './utils';
import { durations } from './vexflow';

const DEBUG = true;

export async function determineDuration(song: Song, note: NoteEvent): Promise<NoteDuration | undefined> {
  const sheet = song.musicsheets.horizontalSheet;

  const leftPadding = 15;
  const rightPadding = 5;
  const padding = leftPadding + rightPadding;
  const size = 30 + padding;

  const dims = {
    x: note.horizontalSheetX * 2 - leftPadding,
    y: sheet.totalHeight,
    w: size,
    h: sheet.totalHeight,
  };

  const imgPath = join(__dirname, '../images', 'final.png');
  const region = await Jimp.read(imgPath);
  region.crop(dims);

  // @ts-ignore
  await debugJimp(region, 'region');

  for (let dot = 0; dot < 2; dot++) {
    for (let stem = 0; stem < 2; stem++) {
      for (let d = 0; d < durations.length; d++) {
        const duration = durations[d];

        const ln = note.notesL[0];
        const n: Note = {
          note: ln.name,
          octave: (Math.floor(ln.key / 12) - 1) as Octave,
          duration,
          dot: dot ? true : false,
          stem: stem ? 'up' : 'down',
          clef: 'bass',
        };

        // if (duration !== 'q' || n.dot || n.stem === 'down') continue;

        // console.log('checking', n);

        const templatePath = join(getNoteDir(n), getNoteFile(n));
        const template = await Jimp.read(templatePath);

        // @ts-ignore
        await debugJimp(template, 'template');

        const contours = await templateMatch(region.bitmap, template.bitmap, 0.7);

        if (contours.size() > 0) {
          console.log('Found note', relative(join(__dirname, '../images/'), templatePath));
          return duration;
        }
      }
    }
  }

  console.log('could not find note');
}

async function templateMatch(img: Bitmap, template: Bitmap, threshold: number) {
  const src = cv.matFromImageData(img);
  const templ = cv.matFromImageData(template);
  const processedImage = new cv.Mat();
  const mask = new cv.Mat();

  cv.matchTemplate(src, templ, processedImage, cv.TM_CCOEFF_NORMED, mask);
  await debugMatrix(processedImage, 'matched');

  cv.threshold(processedImage, processedImage, threshold, 1, cv.THRESH_BINARY);
  await debugMatrix(processedImage, 'thresholded');

  processedImage.convertTo(processedImage, cv.CV_8UC1);
  await debugMatrix(processedImage, 'converted');

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  cv.findContours(processedImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  return contours;
}

async function debugMatrix(matrix, name: string) {
  if (!DEBUG) return;

  await mkdir(join(__dirname, '../images/debug'), { recursive: true });

  // write opencv matrix to file with jimp
  const img = new Jimp({ width: matrix.cols, height: matrix.rows });
  img.bitmap.data = Buffer.from(matrix.data);

  const output = join(__dirname, '../images/debug', `${name}.png`);
  // @ts-ignore
  await img.write(output);
}

async function debugJimp(img: JimpInstance, name: string) {
  if (!DEBUG) return;

  await mkdir(join(__dirname, '../images/debug'), { recursive: true });

  const output = join(__dirname, '../images/debug', `${name}.png`);
  // @ts-ignore
  await img.write(output);
}
