import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Jimp } from 'jimp';
import { join } from 'path';

import { determineDuration } from './matching';
import { NoteflightData, Notes, Song } from './types';
import { drawRectOutline } from './utils';
import { generateAllNotes, generateNoteImages } from './vexflow';

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

async function imageIdentify(song: Song) {
  const input = join(__dirname, 'images', 'final.png');
  const image = await Jimp.read(input);

  const sheet = song.musicsheets.horizontalSheet;
  const notes = song.noteEvents;

  const leftPadding = 15;
  const rightPadding = 5;
  const padding = leftPadding + rightPadding;
  const size = 30 + padding;

  notes.forEach((n) => {
    if (n.notesL.length > 0)
      drawRectOutline(
        image,
        n.horizontalSheetX * 2 - leftPadding,
        sheet.totalHeight,
        size,
        sheet.totalHeight,
        0x000000ff
      );
    if (n.notesR.length > 0)
      drawRectOutline(image, n.horizontalSheetX * 2 - leftPadding, 0, size, sheet.totalHeight, 0x000000ff);
  });

  const output = join(__dirname, 'images', 'annotated.png');
  // @ts-ignore
  await image.write(output);
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
  // await step("image identify", () => imageIdentify(song));

  await generateAllNotes();

  // await generateNoteImages({ note: 'D', octave: 2, clef: 'bass' });

  // await step('determine duration', () => determineDuration(song, song.noteEvents[0]));
  // await step('determine duration', () => determineDuration(song, song.noteEvents[1]));
  // await step('determine duration', () => determineDuration(song, song.noteEvents[2]));

  // await determineDuration(song, song.noteEvents[0]);
  await determineDuration(song, song.noteEvents[1]);
  // await determineDuration(song, song.noteEvents[2]);

  return;

  const notes = song.noteEvents;
  const duration = song.videoDuration;
  const startTime = notes[0].t;

  let longest: Notes;
  notes.forEach((n) => {
    n.notesL.forEach((l) => {
      if (!longest || l.duration > longest.duration) longest = l;
    });

    n.notesR.forEach((r) => {
      if (!longest || r.duration > longest.duration) longest = r;
    });
  });

  // console.log("Longest note duration: ", longest);

  // console.log(
  //   notes.map((n) => {
  //     return [n.notesL.map((l) => l.duration), n.notesR.map((r) => r.duration)];
  //   })
  // );
}

parse();
