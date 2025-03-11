import { Bitmap, Jimp } from 'jimp';
import { cv } from 'opencv-wasm';
import { join } from 'path';

import { Note, Song } from './types';
import { getNoteDir, getNoteFile } from './utils';

export async function determineDuration(song: Song) {
  const sheet = song.musicsheets.horizontalSheet;
  const notes = song.noteEvents;

  const leftPadding = 15;
  const rightPadding = 5;
  const padding = leftPadding + rightPadding;
  const size = 30 + padding;

  const note = notes[0];

  const dims = {
    x: note.horizontalSheetX * 2 - leftPadding,
    y: sheet.totalHeight,
    width: size,
    height: sheet.totalHeight,
  };

  const imgPath = join(__dirname, '../images', 'final.png');
  const img = await Jimp.read(imgPath);

  const region = new Jimp({ width: dims.width, height: dims.height });
  region.composite(img, dims.x, dims.y);

  const n: Note = { note: 'D', octave: 4, duration: 'q', dot: false, stem: 'up' };
  const templatePath = join(getNoteDir(n), getNoteFile(n));
  const template = await Jimp.read(templatePath);

  const contours = await templateMatch(region.bitmap, template.bitmap, 0.8);
  console.log(contours.size());
}

async function templateMatch(img: Bitmap, template: Bitmap, threshold: number) {
  let src = cv.matFromImageData(img);
  let templ = cv.matFromImageData(template);
  let processedImage = new cv.Mat();
  let mask = new cv.Mat();

  cv.matchTemplate(src, templ, processedImage, cv.TM_CCOEFF_NORMED, mask);
  cv.threshold(processedImage, processedImage, threshold, 1, cv.THRESH_BINARY);
  processedImage.convertTo(processedImage, cv.CV_8UC1);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();

  cv.findContours(processedImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  return contours;
}
