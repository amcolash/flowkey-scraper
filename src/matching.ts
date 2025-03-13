import { mkdir } from 'fs/promises';
import { Bitmap, Jimp, JimpInstance } from 'jimp';
import { cv } from 'opencv-wasm';
import { join } from 'path';

import { NoteDuration, NoteEvent, Song } from './types';
import { getNoteDir, getNoteFile } from './utils';
import { durations } from './vexflow';

const DEBUG = false;

const leftPadding = 15;
const rightPadding = 5;
const padding = leftPadding + rightPadding;
const size = 30 + padding;

export async function determineDuration(
  song: Song,
  note: NoteEvent,
  clef: 'bass' | 'treble'
): Promise<NoteDuration | undefined> {
  const sheet = song.musicsheets.horizontalSheet;

  const dims = {
    x: note.horizontalSheetX * 2 - leftPadding,
    y: clef === 'treble' ? 0 : sheet.totalHeight,
    w: size,
    h: sheet.totalHeight,
  };

  if ((clef === 'treble' && note.notesR.length === 0) || (clef === 'bass' && note.notesL.length === 0)) {
    console.log('Could not find note');
    return;
  }

  const imgPath = join(__dirname, '../images', 'final.png');
  const region = await Jimp.read(imgPath);
  region.crop(dims);

  // @ts-ignore
  await debugJimp(region, 'region');

  let bestMatch: { duration: NoteDuration; score: number; dot: boolean; stem: 'up' | 'down' } | null = null;

  for (let dot = 0; dot < 2; dot++) {
    for (let stem = 0; stem < 2; stem++) {
      for (let d = 0; d < durations.length; d++) {
        const duration = durations[d];

        const n = {
          duration,
          dot: !!dot,
          stem: (stem ? 'up' : 'down') as 'up' | 'down',
        };

        const templatePath = join(getNoteDir(), getNoteFile(n));
        const template = await Jimp.read(templatePath);

        // @ts-ignore
        await debugJimp(template, 'template');

        const score = await templateMatch(region.bitmap, template.bitmap);

        if (score !== null && (bestMatch === null || score > bestMatch.score)) {
          bestMatch = { duration, score, dot: !!dot, stem: (stem ? 'up' : 'down') as 'up' | 'down' };
        }
      }
    }
  }

  if (bestMatch && bestMatch.score > 0.6) {
    console.log(
      'Best match:',
      bestMatch.duration,
      'with score:',
      bestMatch.score.toFixed(3),
      'dot:',
      bestMatch.dot,
      'stem:',
      bestMatch.stem
    );
    return bestMatch.duration;
  }

  console.log('Could not find note');
}

async function templateMatch(img: Bitmap, template: Bitmap): Promise<number | null> {
  const src = cv.matFromImageData(img);
  const templ = cv.matFromImageData(template);
  const processedImage = new cv.Mat();

  if (src.empty() || templ.empty()) {
    console.error(`Invalid image: src (${src.cols}x${src.rows}), templ (${templ.cols}x${templ.rows})`);
    return null;
  }

  // Skip if the template is larger than the source image
  if (templ.cols > src.cols || templ.rows > src.rows) {
    if (DEBUG)
      console.warn(
        `Skipping template: Template ${templ.cols}x${templ.rows} is larger than Source ${src.cols}x${src.rows}`
      );
    return null; // Or continue to the next iteration
  }

  try {
    cv.matchTemplate(src, templ, processedImage, cv.TM_CCOEFF_NORMED);
    await debugMatrix(processedImage, 'matched');

    if (processedImage.empty()) {
      throw new Error(`Processed image is empty after matchTemplate`);
    }

    const result = cv.minMaxLoc(processedImage);
    return result.maxVal; // Return the best match score
  } catch (err) {
    console.error(`Error: ${err.message}`, err.stack);
    return null;
  } finally {
    src.delete();
    templ.delete();
    processedImage.delete();
  }
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
