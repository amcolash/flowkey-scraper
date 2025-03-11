import { join } from 'path';

import { Note } from './types';

// https://app.studyraid.com/en/read/12495/404090/basic-shape-drawing
export function drawRectOutline(image, x: number, y: number, w: number, h: number, color) {
  // Horizontal lines
  for (let i = x; i <= x + w; i++) {
    image.setPixelColor(color, i, y);
    image.setPixelColor(color, i, y + h);
  }

  // Vertical lines
  for (let j = y; j <= y + h; j++) {
    image.setPixelColor(color, x, j);
    image.setPixelColor(color, x + w, j);
  }
}

export function getNoteDir(note: Pick<Note, 'note' | 'octave' | 'clef'>): string {
  return join(__dirname, `../images/notes/${note.clef || 'treble'}/${note.note}${note.octave}`);
}

export function getNoteFile(note: Note): string {
  return `${note.duration}${note.dot ? '_dot' : ''}_${note.stem}.png`;
}
