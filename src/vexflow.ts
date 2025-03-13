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

export async function generateNoteImages() {
  // Connect it to the rendering context and draw
  const stave = new Stave(0, -30, 100);
  stave.setContext(context);

  const noteDir = getNoteDir();
  await mkdir(noteDir, { recursive: true });

  // Draw notes
  for (let dot = 0; dot < 2; dot++) {
    for (let stem = 0; stem < 2; stem++) {
      for (let d = 0; d < durations.length; d++) {
        const duration = durations[d];
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
            keys: ['C/4'],
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
}
