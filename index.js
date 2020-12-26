const fs = require('fs');
const path = require('path');
const MidiWriter = require('midi-writer-js');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');

const DEBUG = true;

const templates = {
  dot: { mat: cv.imread('./templates/dot.png'), thresh: 0.25 },
  halfBar: { mat: cv.imread('./templates/half-bar.png'), thresh: 0.25 },
  halfBlank: { mat: cv.imread('./templates/half-blank.png'), thresh: 0.25 },
  quarter: { mat: cv.imread('./templates/quarter.png'), thresh: 0.25 },
  wholeBar: { mat: cv.imread('./templates/whole-bar.png'), thresh: 0.25 },
  wholeBlank: { mat: cv.imread('./templates/whole-blank.png'), thresh: 0.25 },
  eighth: { mat: cv.imread('./templates/eighth.png'), thresh: 0.2 },
  tieLeft: { mat: cv.imread('./templates/tie-left.png'), thresh: 0.25 },
};

const barsTemplate = { mat: cv.imread('./templates/bars.png'), thresh: 0.2 };
const measureTemplate = { mat: cv.imread('./templates/measure.png'), thresh: 0.1 };
const tieRightTemplate = { mat: cv.imread('./templates/tie-right.png'), thresh: 0.25 };

const timeSignatures = {
  time_3_4: { mat: cv.imread('./templates/3-4.png'), thresh: 0.2 },
  time_4_4: { mat: cv.imread('./templates/4-4.png'), thresh: 0.2 },
  time_6_8: { mat: cv.imread('./templates/6-8.png'), thresh: 0.2 },
};

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

function getMatchedTemplates(mat, templates, multi) {
  const matches = {};

  Object.entries(templates).forEach((t) => {
    const name = t[0];
    const value = t[1];
    const template = value.mat;

    const match = mat.matchTemplate(template, cv.TM_CCOEFF_NORMED);

    if (!multi) {
      const minMax = match.minMaxLoc();
      // if (DEBUG) console.log(name, minMax);

      if (minMax.maxVal > 1 - value.thresh) {
        matches[name] = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };

        // if (DEBUG) console.log(name, minMax);
        if (DEBUG)
          mat.drawRectangle(
            new cv.Rect(minMax.maxLoc.x, minMax.maxLoc.y, template.cols, template.rows),
            new cv.Vec3(0, 0, 255),
            2,
            cv.LINE_8
          );
      }
    } else {
      const dataList = match.getDataAsArray();
      matches[name] = [];

      for (let y = 0; y < dataList.length; y++) {
        for (let x = 0; x < dataList[y].length; x++) {
          if (dataList[y][x] > 1 - value.thresh) {
            matches[name].push({ x, y });
            if (DEBUG) {
              // console.log(name, x, y, dataList[y][x]);
              mat.drawRectangle(new cv.Rect(x, y, template.cols, template.rows), new cv.Vec3(0, 0, 255), 2, cv.LINE_8);
            }
          }
        }
      }
    }
  });

  return matches;
}

function handleTies(newCrop) {
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

function getMeasures(mat) {
  const rightBar = mat.getRegion(new cv.Rect(0, 0, mat.cols, mat.rows / 2));
  const rightBarMatch = getMatchedTemplates(rightBar.copy(), { bars: barsTemplate });
  const rightCrop = rightBar.getRegion(new cv.Rect(0, rightBarMatch.bars.y, mat.cols, barsTemplate.mat.rows));
  const rightMeasure = getMatchedTemplates(rightCrop, { measure: measureTemplate }, true);

  // Filter out duplicate results
  const filteredMeasure = [];
  rightMeasure.measure.forEach((m) => {
    let duplicate = false;
    filteredMeasure.forEach((f) => {
      if (Math.abs(m.x - f.x) < 50) duplicate = true;
    });
    if (!duplicate) filteredMeasure.push(m);
  });
  // Add first measure
  filteredMeasure.push({ x: 0, y: filteredMeasure[0].y });

  const measures = filteredMeasure
    .sort((a, b) => a.x - b.x)
    .map((m, i) => {
      return { x1: m.x, x2: i < filteredMeasure.length - 1 ? filteredMeasure[i + 1].x : mat.cols };
    });

  return measures;
}

// 0-indexed position
function findMeasure(x, measures) {
  for (let i = 0; i < measures.length; i++) {
    if (x > measures[i].x1 && x <= measures[i].x2) return i;
  }

  return -1;
}

async function parseSong(song) {
  const notes = song.noteEvents;

  await downloadImages(song);

  const mat = cv.imread('./tmp/output.png');

  const measures = getMeasures(mat.copy());

  const timeSig = getMatchedTemplates(mat, timeSignatures);
  console.log(timeSig);

  // console.log(measures);
  // measures.forEach((m) => {
  // const measure = mat.getRegion(new cv.Rect(m.x1, 0, m.x2 - m.x1, mat.rows));
  // if (DEBUG) cv.imshow('window', measure);
  // if (DEBUG) cv.waitKey();
  // });

  // if (DEBUG) cv.imshow('window', leftCrop);
  // if (DEBUG) cv.waitKey();

  return;

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
        extraDuration = handleTies(newCrop);
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

  rightNotes.forEach((n, i) => {
    // const notes = n.notesR.map((r) => `${r.name.replace('♭', 'b').replace('♯', '#')}${r.octave}`);
    const notes = n.notesR.map((r) => r.key);
    if (Array.isArray(n.d)) n.d.forEach((d) => rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: d })));
    else rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d }));
  });

  leftNotes.forEach((n, i) => {
    // const notes = n.notesL.map((l) => `${l.name.replace('♭', 'b').replace('♯', '#')}${l.octave}`);
    const notes = n.notesL.map((l) => l.key);
    if (Array.isArray(n.d)) n.d.forEach((d) => leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: d })));
    else leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d }));
  });

  const write = new MidiWriter.Writer([rightTrack, leftTrack]);
  write.saveMIDI(song.title);
}

// Init and parse song
const song = JSON.parse(fs.readFileSync('test.json').toString()).data.song;
parseSong(song);
