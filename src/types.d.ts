export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '?';
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Octave = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Note = {
  note: NoteName;
  octave: Octave;
  duration: NoteDuration;
  dot: boolean;
  stem: 'up' | 'down';
  clef?: 'treble' | 'bass';
};

// Noteflight types
export interface NoteflightData {
  data: Data;
}

export interface Data {
  song: Song;
}

export interface Song {
  _id: string;
  artist: string;
  arrangement: null;
  title: string;
  songGroupId: string;
  level: number;
  hasMidiSoundsData: boolean;
  lightningKeys: LightningKeys;
  musicsheets: Musicsheets;
  noteEvents: NoteEvent[];
  sustainPedalData: SustainPedalData[];
  videoMp4Url: string;
  videoDuration: number;
}

export interface LightningKeys {
  xPositions: number[];
  yOffset: number;
  keyIndexRanges: KeyIndexRanges;
}

export interface KeyIndexRanges {
  left: IntRange;
  right: IntRange;
  both: IntRange;
}

export interface IntRange {
  lowest: number;
  highest: number;
}

export interface Musicsheets {
  horizontalSheet: HorizontalSheet;
}

export interface HorizontalSheet {
  files: Files;
  totalWidth: number;
  totalHeight: number;
  yOffset: number;
  sliceWidth: number;
}

export interface Files {
  png2x: string[];
}

export interface NoteEvent {
  t: number;
  notesL: Notes[];
  notesR: Notes[];
  horizontalSheetX: number;
}

export interface Notes {
  key: number;
  name: NoteName;
  delay: number;
  duration: number;
  velocity: number;
  isInArpeggio: boolean;
}

export interface SustainPedalData {
  t: number;
  value: number;
}
