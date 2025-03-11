import { createCanvas } from 'canvas';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { Dot, Formatter, Renderer, Stave, StaveNote, Stem } from 'vexflow';

import { Note, NoteDuration, Song } from './types';
import { getNoteDir, getNoteFile } from './utils';

// Set up a fake DOM environment for Vexflow to work.
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;

// Create global canvas, renderer, and context for note generation
const canvas = createCanvas(50, 160);
const renderer = new Renderer(canvas as any as HTMLCanvasElement, Renderer.Backends.CANVAS);
const context = renderer.getContext();

// Note durations to generate
const durations: NoteDuration[] = ['w', 'h', 'q', 'q', '8', '16'];

export async function generateNoteImages(rootNote: Pick<Note, 'note' | 'octave' | 'clef'>) {
  // Connect it to the rendering context and draw
  const stave = new Stave(-5, 20, 55);
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

        if (existsSync(output)) continue;

        context.clear();
        stave.draw();

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

        // Save the image
        await writeFile(output, canvas.toBuffer());
      }
    }
  }
}
