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
const canvas = createCanvas(50, 189);
const renderer = new Renderer(canvas as any as HTMLCanvasElement, Renderer.Backends.CANVAS);
const context = renderer.getContext();

const scale = 1.76;
context.scale(scale, scale);

// Note durations to generate
export const durations: NoteDuration[] = ['w', 'h', 'q', '8', '16'];

export async function generateNoteImages(rootNote: Pick<Note, 'note' | 'octave' | 'clef'>) {
  // Connect it to the rendering context and draw
  const stave = new Stave(-10, -7.7, 55);
  stave.setContext(context);

  const keys = [`${rootNote.note}/${rootNote.octave}`];

  const noteDir = getNoteDir(rootNote);
  await mkdir(noteDir, { recursive: true });

  // Draw notes
  for (let dot = 0; dot < 2; dot++) {
    for (let stem = 0; stem < 2; stem++) {
      for (let d = 0; d < durations.length; d++) {
        const duration = durations[d];
        const note: Note = {
          note: rootNote.note,
          octave: rootNote.octave,
          duration,
          dot: dot === 1,
          stem: stem ? 'up' : 'down',
        };
        const output = join(noteDir, getNoteFile(note));

        // if (existsSync(output)) continue;

        context.clear();
        // let prev = context.fillStyle;
        // context.fillStyle = 'white';
        // context.fillRect(0, 0, canvas.width, canvas.height);
        // context.fillStyle = prev;

        // stave.draw();

        const notes: StaveNote[] = [
          new StaveNote({
            keys,
            duration,
            stemDirection: stem ? Stem.UP : Stem.DOWN,
            clef: rootNote.clef || 'treble',
          }),
        ];

        if (dot) Dot.buildAndAttach(notes);
        Formatter.FormatAndDraw(context, stave, notes);

        const scaled = await Jimp.fromBuffer(canvas.toBuffer());
        // scaled.bitmap.data = canvas.toBuffer();

        const scale = 2;
        // scaled.resize({ h: canvas.height * scale, w: canvas.width * scale });
        // scaled.crop({
        //   x: (scaled.width - canvas.width) / 2,
        //   y: (scaled.height - canvas.height) / 2,
        //   w: canvas.width,
        //   h: canvas.height,
        // });

        // Save the image

        // @ts-ignore
        scaled.write(output);
        // await writeFile(output, canvas.toBuffer());
      }
    }
  }
}

export async function generateAllNotes() {
  // generate bass clef note images (c2-c4)
  for (let o = 2; o <= 4; o++) {
    for (let n = 0; n < 7; n++) {
      // @ts-ignore
      await generateNoteImages({ note: 'CDEFGAB'[n], octave: o, clef: 'bass' });
    }
  }

  // generate treble clef note images (c4-c6)
  for (let o = 4; o <= 6; o++) {
    for (let n = 0; n < 7; n++) {
      // @ts-ignore
      await generateNoteImages({ note: 'CDEFGAB'[n], octave: o, clef: 'treble' });
    }
  }
}
