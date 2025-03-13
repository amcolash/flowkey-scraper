import { join } from 'path';

import { Note, NoteDuration } from './types';

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

const noteMapping: Record<NoteDuration, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': 'sixteenth',
};

export function getNoteDir(duration: NoteDuration): string {
  return join(__dirname, `../images/notes/`, noteMapping[duration]);
}

export function getNoteFile(note: Pick<Note, 'duration' | 'dot' | 'stem'>): string {
  return `${note.duration}${note.dot ? '_dot' : ''}_${note.stem}.png`;
}
