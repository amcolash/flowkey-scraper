import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Jimp } from 'jimp';
import { join } from 'path';

import { determineDuration } from './matching';
import { NoteflightData, Song } from './types';
import { generateNoteImages } from './vexflow';

async function downloadImages(song: Song) {
  await mkdir('./images/sheets', { recursive: true });

  const images = song.musicsheets.horizontalSheet.files.png2x;
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const file = join(__dirname, 'images/sheets', `${i}.png`);
    if (!existsSync(file)) {
      const response = await fetch(image);
      const buffer = await response.arrayBuffer();

      await writeFile(file, Buffer.from(buffer));
    }
  }
}

async function imageComposite(song: Song) {
  const dest = join(__dirname, 'images', 'final.png');
  if (existsSync(dest)) return;

  const sheet = song.musicsheets.horizontalSheet;
  const images = sheet.files.png2x;
  const final = new Jimp({ height: sheet.totalHeight * 2, width: sheet.totalWidth * 2, color: 0xffffffff });

  for (let i = 0; i < images.length; i++) {
    const file = join(__dirname, 'images/sheets', `${i}.png`);
    const img = await Jimp.read(file);

    final.composite(img, i * sheet.sliceWidth * 2, 0);
  }

  // @ts-ignore (incorrect jimp type)
  await final.write(dest);
}

async function step(name: string, fn: () => Promise<any>) {
  console.log(`starting: ${name}`);
  await fn();
  console.log(`complete: ${name}`);
}

async function parse() {
  const dataFile = join(__dirname, 'data.json');
  const data: NoteflightData = JSON.parse(await readFile(dataFile, 'utf-8'));
  const song = data.data.song;

  // await step("downloading images", () => downloadImages(song));
  // await step("image composite", () => imageComposite(song));

  await step('generate note images', () => generateNoteImages());

  await determineDuration(song, song.noteEvents[0], 'bass');
  await determineDuration(song, song.noteEvents[1], 'bass');
  await determineDuration(song, song.noteEvents[2], 'bass');
  await determineDuration(song, song.noteEvents[3], 'bass');
}

parse();
