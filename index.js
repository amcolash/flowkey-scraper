const fs = require('fs');
const path = require('path');
const MidiWriter = require('midi-writer-js');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');

const DEBUG = true;

const dot = cv.imread('./templates/dot.png');
const halfBar = cv.imread('./templates/half-bar.png');
const halfBlank = cv.imread('./templates/half-blank.png');
const quarter = cv.imread('./templates/quarter.png');
const wholeBar = cv.imread('./templates/whole-bar.png');
const wholeBlank = cv.imread('./templates/whole-blank.png');
const eighth = cv.imread('./templates/eighth.png');
const tieLeft = cv.imread('./templates/tie-left.png');
const tieRight = cv.imread('./templates/tie-right.png');

const templates = {
  dot: { mat: dot, thresh: 0.25 },
  halfBar: { mat: halfBar, thresh: 0.25 },
  halfBlank: { mat: halfBlank, thresh: 0.25 },
  quarter: { mat: quarter, thresh: 0.25 },
  wholeBar: { mat: wholeBar, thresh: 0.25 },
  wholeBlank: { mat: wholeBlank, thresh: 0.25 },
  eighth: { mat: eighth, thresh: 0.2 },
  tieLeft: { mat: tieLeft, thresh: 0.25 },
};

const tieRightTemplate = { mat: tieRight, thresh: 0.25 };

function getDuration(matches, extraDuration) {
  let duration = '8';
  if (matches.wholeBar || matches.wholeBlank) duration = '1';
  if (matches.halfBar || matches.halfBlank) duration = '2';
  if (matches.quarter) duration = '4';
  if (matches.eighth) duration = '8';
  if (matches.dot) duration = 'd' + duration;

  if (extraDuration) return [duration, extraDuration];
  return duration;
}

async function downloadImages(song) {
  if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');

  const imgs = song.musicsheets.imageURLs2x.map((i) => {
    return new Promise((resolve, reject) => {
      const file = path.join('tmp', path.basename(i));
      if (fs.existsSync(file)) {
        resolve();
        return;
      }

      axios
        .get(i, { responseType: 'arraybuffer' })
        .then((res) => {
          fs.writeFileSync(file, res.data);

          const args = [file, '-background', 'white', '-flatten', '-draw', 'fill white rectangle 0,170 1024,210', file];
          im.convert(args, (err, stdout) => {
            if (err) throw err;
            resolve();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });
  });

  await Promise.all(imgs);

  const combined = 'tmp/output.png';
  if (fs.existsSync(combined)) fs.unlinkSync(combined);
  const files = fs
    .readdirSync('tmp/')
    .map((f) => 'tmp/' + f)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  await new Promise((resolve, reject) => {
    im.convert([...files, '+append', combined], (err, stdout) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function getMatchedTemplates(mat, templates) {
  const matches = {};

  Object.entries(templates).forEach((t) => {
    const name = t[0];
    const value = t[1];
    const template = value.mat;

    const match = mat.matchTemplate(template, cv.TM_CCOEFF_NORMED);
    const minMax = match.minMaxLoc();

    // if (DEBUG) console.log(name, minMax);

    if (minMax.maxVal > 1 - value.thresh) {
      matches[name] = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };

      if (DEBUG)
        mat.drawRectangle(
          new cv.Rect(minMax.maxLoc.x, minMax.maxLoc.y, template.cols, template.rows),
          new cv.Vec3(0, 0, 255),
          2,
          cv.LINE_8
        );
    }
  });

  return matches;
}

function handleTies(mat, newCrop) {
  const copiedCrop = newCrop.copy();
  const match = getMatchedTemplates(copiedCrop, { tieRight: tieRightTemplate });

  // if (DEBUG) cv.imshow('window', copiedCrop);
  // if (DEBUG) cv.waitKey();

  if (match.tieRight) {
    const rightCrop = newCrop.getRegion(new cv.Rect(match.tieRight.x + 10, 0, 65, newCrop.rows));

    const tieMatch = getMatchedTemplates(rightCrop, templates);

    // if (DEBUG) cv.imshow('window', rightCrop);
    // if (DEBUG) cv.waitKey();

    return getDuration(tieMatch);
  }
}

async function parseSong(song) {
  const notes = song.noteEvents;

  await downloadImages(song);

  const mat = cv.imread('./tmp/output.png');

  const numNotes = 4;
  for (let i = 0; i < numNotes; i++) {
    const cropped = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, 0, 65, mat.rows)).copy();

    const halfHeight = cropped.rows / 2;
    const leftBar = cropped.getRegion(new cv.Rect(0, halfHeight, cropped.cols, halfHeight));
    const rightBar = cropped.getRegion(new cv.Rect(0, 0, cropped.cols, halfHeight));

    [leftBar, rightBar].forEach((bar, j) => {
      const matches = getMatchedTemplates(bar, templates);

      let extraDuration;
      if (matches.tieLeft) {
        let newCrop;
        if (j === 0) newCrop = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, halfHeight, 250, halfHeight));
        else newCrop = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, 0, 250, halfHeight));
        extraDuration = handleTies(mat, newCrop);
      }

      // console.log(matches);
      const duration = getDuration(matches, extraDuration);
      // console.log(duration);

      if (j === 0) notes[i].ld = duration;
      if (j === 1) notes[i].rd = duration;

      // if (DEBUG) cv.imshow('window', bar);
      // if (DEBUG) cv.waitKey();
    });
  }

  let min = 9999999999;

  const leftNotes = [];
  const rightNotes = [];
  notes.forEach((n, i) => {
    if (i >= numNotes) return;

    if (n.notesL.length > 0) leftNotes.push({ x: n.x, t: n.t, d: n.ld, notesL: n.notesL });
    if (n.notesR.length > 0) rightNotes.push({ x: n.x, t: n.t, d: n.rd, notesR: n.notesR });

    min = Math.min(min, n.t);
  });

  const rightTrack = new MidiWriter.Track();
  const leftTrack = new MidiWriter.Track();

  rightTrack.setTimeSignature(6, 8);
  leftTrack.setTimeSignature(6, 8);

  // const bpm = 120;
  // const tpb = 120; // ticks per beat
  // const tps = 60000 / (bpm * tpb); // ticks per second

  rightNotes.forEach((n, i) => {
    // const ticks = ((n.t - min) / 1000) * tps;
    // const notes = n.notesR.map((r) => `${r.name.replace('♭', 'b').replace('♯', '#')}${r.octave}`);
    const notes = n.notesR.map((r) => r.key);
    // rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d, wait: 'T' + ticks }));
    if (Array.isArray(n.d)) n.d.forEach((d) => rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: d })));
    else rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d }));
  });

  leftNotes.forEach((n, i) => {
    // const ticks = ((n.t - min) / 1000) * tps;
    // const notes = n.notesL.map((l) => `${l.name.replace('♭', 'b').replace('♯', '#')}${l.octave}`);
    const notes = n.notesL.map((l) => l.key);
    // leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d, wait: 'T' + ticks }));
    if (Array.isArray(n.d)) n.d.forEach((d) => leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: d })));
    else leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d }));
  });

  const write = new MidiWriter.Writer([rightTrack, leftTrack]);
  write.saveMIDI(song.title);
}

// Init and parse song
const song = JSON.parse(fs.readFileSync('test.json').toString()).data.song;
parseSong(song);
