import { createCanvas } from 'canvas';
import { mkdir } from 'fs/promises';
import { Jimp } from 'jimp';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { Dot, Formatter, Renderer, Stave, StaveNote, Stem } from 'vexflow';

import { Note, NoteDuration } from './types';
import { getNoteDir, getNoteFile } from './utils';

// Set up a fake DOM environment for Vexflow to work.
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;

// Create global canvas, renderer, and context for note generation
const canvas = createCanvas(100, 250);
const renderer = new Renderer(canvas as any as HTMLCanvasElement, Renderer.Backends.CANVAS);
const context = renderer.getContext();

const scale = 1.76;
context.scale(scale, scale);

// Note durations to generate
export const durations: NoteDuration[] = ['w', 'h', 'q', '8', '16'];

type Options = {
  stem?: boolean;
  additionalNotes?: string[];
};

const durationData: Record<NoteDuration, Options> = {
  w: { stem: false },
  h: {},
  q: {},
  '8': {},
  '16': {},
};

export async function generateNoteImages() {
  for (const duration of durations) {
    generateNoteDurations(duration, 'C/4');
    generateNoteDurations(duration, 'D/4');

    if (durationData[duration].additionalNotes) {
      for (const note of durationData[duration].additionalNotes) {
        generateNoteDurations(duration, note);
      }
    }
  }
}

async function generateNoteDurations(duration: NoteDuration, note: string) {
  const noteDir = getNoteDir(duration);
  await mkdir(noteDir, { recursive: true });

  const data = durationData[duration];

  // Connect stave to the rendering context
  const stave = new Stave(0, -30, 100);
  stave.setContext(context);
  // stave.draw();

  // Draw notes
  for (let dot = 0; dot < 2; dot++) {
    for (let stem = 0; stem < (data.stem !== false ? 2 : 1); stem++) {
      const note = {
        duration,
        dot: dot === 1,
        stem: stem ? 'up' : ('down' as 'up' | 'down'),
      };

      const output = join(noteDir, getNoteFile(note));
      // if (existsSync(output)) continue;

      context.clear();

      const notes: StaveNote[] = [
        new StaveNote({
          keys: duration === 'w' && stem ? ['D/4'] : ['C/4'],
          duration,
          stemDirection: stem ? Stem.UP : Stem.DOWN,
          clef: 'treble',
        }),
      ];

      if (dot) Dot.buildAndAttach(notes);
      Formatter.FormatAndDraw(context, stave, notes);

      const scaled = (await Jimp.fromBuffer(canvas.toBuffer())).autocrop();
      const final = new Jimp({ width: scaled.width, height: scaled.height, color: 0xffffffff });
      final.composite(scaled);

      // @ts-ignore
      final.write(output);
    }
  }
}
