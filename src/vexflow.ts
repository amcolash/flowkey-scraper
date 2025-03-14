import { createCanvas } from 'canvas';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { Jimp } from 'jimp';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, Stem } from 'vexflow';

import { NoteDuration } from './types';
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
  stems: boolean;
  extraNotes?: string[];
  beams?: boolean;
};

type NoteConfig = {
  duration: NoteDuration;
  note: string;
  stem: 'up' | 'down';
  dot: boolean;
  beams: boolean;
};

// Add a few different notes to get different beam slopes
const defaultBeams = { beams: true, extraNotes: ['B/3', 'E/4', 'F/4'] };

const noteOptions: Partial<Record<NoteDuration, Options>> = {
  w: { stems: false },
  h: { stems: true },
  q: { stems: true },
  '8': { stems: true, ...defaultBeams },
  '16': { stems: true, ...defaultBeams },
};

function generateConfigs() {
  const configs: NoteConfig[] = [];

  Object.entries(noteOptions).forEach(([d, options]) => {
    const duration = d as NoteDuration;
    const { stems, extraNotes, beams } = options;

    const baseNotes = ['C/4', 'D/4'].concat(extraNotes || []);

    for (const note of baseNotes) {
      configs.push({ duration, note, stem: 'down', dot: false, beams: false });
      // configs.push({ duration, note, stem: 'down', dot: true, beams: false });

      if (stems) {
        configs.push({ duration, note, stem: 'up', dot: false, beams: false });
        // configs.push({ duration, note, stem: 'up', dot: true, beams: false });
      }

      if (beams) {
        configs.push({ duration, note, stem: 'down', dot: false, beams: true });
        // configs.push({ duration, note, stem: 'down', dot: true, beams: true });

        if (stems) {
          configs.push({ duration, note, stem: 'up', dot: false, beams: true });
          // configs.push({ duration, note, stem: 'up', dot: true, beams: true });
        }
      }
    }
  });

  return configs;
}

export async function generateNoteImages() {
  const configs = generateConfigs();

  for (const { duration, note, stem, dot, beams } of configs) {
    await generateNoteImage({ duration, note, stem, dot, beams });
  }
}

async function generateNoteImage({ duration, note, stem, dot, beams }: NoteConfig) {
  const noteDir = getNoteDir(duration);
  await mkdir(noteDir, { recursive: true });

  const outputPath = join(noteDir, getNoteFile(note, dot, stem, beams));
  // if (existsSync(outputPath)) return;

  // Clear the canvas, then reset the fill style
  let prev = context.fillStyle;
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = prev;

  const stave = new Stave(0, -30, 100).setContext(context);
  const noteObj = new StaveNote({
    keys: [note],
    duration,
    stemDirection: stem === 'up' ? Stem.UP : Stem.DOWN,
    clef: 'treble',
  });
  // Static note object for beams to be attached to
  const noteObj2 = new StaveNote({
    keys: ['G/4'],
    duration,
    stemDirection: stem === 'up' ? Stem.UP : Stem.DOWN,
    clef: 'treble',
  });

  const notes = beams ? [noteObj, noteObj2] : [noteObj];

  let beam;
  if (beams) {
    beam = new Beam(notes);
  }

  Formatter.FormatAndDraw(context, stave, notes);
  if (beams) beam.setContext(context).draw();
  if (dot) Dot.buildAndAttach(notes, { all: true });

  if (beams) {
    // Add space on the right side of the image to cut the beam. This allows for auto cropping
    let prev = context.fillStyle;
    context.fillStyle = 'white';
    context.fillRect(canvas.width / scale - 1, 0, 1, canvas.height);
    context.fillStyle = prev;
  }

  const output = await Jimp.fromBuffer(canvas.toBuffer());
  output.autocrop();

  if (beams) {
    // Matching a full note + beam isn't successful, just match partial stem and beam
    const height = output.height - (duration === '16' ? 30 : 35);
    output.crop({ x: 0, y: stem === 'up' ? 0 : output.height - height, w: output.width - 40, h: height });
  }
  // @ts-ignore
  await output.write(outputPath);
}
