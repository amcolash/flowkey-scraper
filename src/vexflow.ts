import { createCanvas } from 'canvas';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { Jimp } from 'jimp';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { Dot, Formatter, Renderer, Stave, StaveNote, Stem } from 'vexflow';

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
};

type NoteConfig = {
  duration: NoteDuration;
  note: string;
  stem: 'up' | 'down';
  dot: boolean;
};

const noteOptions: Record<NoteDuration, Options> = {
  w: { stems: false },
  h: { stems: true },
  q: { stems: true },
  '8': { stems: true },
  '16': { stems: true },
};

function generateConfigs() {
  const configs: NoteConfig[] = [];

  Object.entries(noteOptions).forEach(([d, options]) => {
    const duration = d as NoteDuration;
    const { stems, extraNotes } = options;

    const baseNotes = ['C/4', 'D/4'].concat(extraNotes || []);

    for (const note of baseNotes) {
      configs.push({ duration, note, stem: 'down', dot: false });
      configs.push({ duration, note, stem: 'down', dot: true });

      if (stems) {
        configs.push({ duration, note, stem: 'up', dot: false });
        configs.push({ duration, note, stem: 'up', dot: true });
      }
    }
  });

  return configs;
}

export async function generateNoteImages() {
  const configs = generateConfigs();

  for (const { duration, note, stem, dot } of configs) {
    await generateNoteImage({ duration, note, stem, dot });
  }
}

async function generateNoteImage({ duration, note, stem, dot }: NoteConfig) {
  const noteDir = getNoteDir(duration);
  await mkdir(noteDir, { recursive: true });

  const outputPath = join(noteDir, getNoteFile(note, dot, stem));
  if (existsSync(outputPath)) return;

  context.clear();
  const stave = new Stave(0, -30, 100).setContext(context);
  const noteObj = new StaveNote({
    keys: [note],
    duration,
    stemDirection: stem === 'up' ? Stem.UP : Stem.DOWN,
    clef: 'treble',
  });

  if (dot) Dot.buildAndAttach([noteObj]);
  Formatter.FormatAndDraw(context, stave, [noteObj]);

  // @ts-ignore
  (await Jimp.fromBuffer(canvas.toBuffer())).autocrop().write(outputPath);
}
