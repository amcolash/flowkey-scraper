const fs = require('fs');
const path = require('path');
const MidiWriter = require('midi-writer-js');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');

const song = JSON.parse(fs.readFileSync('test.json').toString()).data.song;
parseSong(song);

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t;
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function getDuration(matches) {
  let duration = '8';
  if (matches.wholeBar || matches.wholeBlank) duration = '1';
  if (matches.halfBar || matches.halfBlank) duration = '2';
  if (matches.quarter) duration = '4';
  if (matches.eighth) duration = '8';
  if (matches.dot) duration = 'd' + duration;

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

async function parseSong(song) {
  const notes = song.noteEvents;

  await downloadImages(song);

  const dot = cv.imread('./templates/dot.png');
  const halfBar = cv.imread('./templates/half-bar.png');
  const halfBlank = cv.imread('./templates/half-blank.png');
  const quarter = cv.imread('./templates/quarter.png');
  const wholeBar = cv.imread('./templates/whole-bar.png');
  const wholeBlank = cv.imread('./templates/whole-blank.png');
  const eighth = cv.imread('./templates/eighth.png');

  const templates = {
    dot: { mat: dot, thresh: 0.25 },
    halfBar: { mat: halfBar, thresh: 0.25 },
    halfBlank: { mat: halfBlank, thresh: 0.25 },
    quarter: { mat: quarter, thresh: 0.25 },
    wholeBar: { mat: wholeBar, thresh: 0.25 },
    wholeBlank: { mat: wholeBlank, thresh: 0.25 },
    eighth: { mat: eighth, thresh: 0.2 },
  };

  const mat = cv.imread('./tmp/output.png');

  const numNotes = 4;
  for (let i = 0; i < numNotes; i++) {
    const cropped = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, 0, 65, mat.rows));

    const halfHeight = cropped.rows / 2;
    const leftBar = cropped.getRegion(new cv.Rect(0, halfHeight, cropped.cols, halfHeight));
    const rightBar = cropped.getRegion(new cv.Rect(0, 0, cropped.cols, halfHeight));

    [leftBar, rightBar].forEach((bar, j) => {
      const tmpMat = bar.copy();

      const matches = {};

      Object.entries(templates).forEach((t) => {
        const name = t[0];
        const value = t[1];
        const mat = value.mat;

        const match = tmpMat.matchTemplate(mat, cv.TM_SQDIFF_NORMED);
        const minMax = match.minMaxLoc();

        if (minMax.minVal < value.thresh) {
          matches[name] = true;

          // tmpMat.drawRectangle(new cv.Rect(minMax.minLoc.x, minMax.minLoc.y, mat.cols, mat.rows), new cv.Vec3(0, 0, 255), 2, cv.LINE_8);
        }
      });

      // console.log(matches);
      const duration = getDuration(matches);
      // console.log(duration);

      if (j === 0) notes[i].ld = duration;
      if (j === 1) notes[i].rd = duration;

      // cv.imshow('a window name', tmpMat);
      // cv.waitKey();
    });
  }

  // return;

  let min = 9999999999;

  const leftNotes = [];
  const rightNotes = [];
  notes.forEach((n, i) => {
    if (i >= numNotes) return;

    if (n.notesL.length > 0) leftNotes.push({ x: n.x, t: n.t, d: n.ld, notesL: n.notesL });
    if (n.notesR.length > 0) rightNotes.push({ x: n.x, t: n.t, d: n.rd, notesR: n.notesR });

    min = Math.min(min, n.t);
  });

  // for (let i = 0; i < leftNotes.length - 1; i++) {
  //   leftNotes[i].d = leftNotes[i + 1].t - leftNotes[i].t;
  // }
  // leftNotes[leftNotes.length - 1].d = song.syncData.t[song.syncData.t.length - 1] - leftNotes[leftNotes.length - 1].t;

  // for (let i = 0; i < rightNotes.length - 1; i++) {
  //   rightNotes[i].d = rightNotes[i + 1].t - rightNotes[i].t;
  // }
  // rightNotes[rightNotes.length - 1].d = song.syncData.t[song.syncData.t.length - 1] - rightNotes[rightNotes.length - 1].t;

  const rightTrack = new MidiWriter.Track();
  const leftTrack = new MidiWriter.Track();

  rightTrack.setTimeSignature(6, 8);
  leftTrack.setTimeSignature(6, 8);

  const bpm = 120;
  const tpb = 120; // ticks per beat
  const tps = 60000 / (bpm * tpb); // ticks per second

  rightNotes.forEach((n, i) => {
    const ticks = ((n.t - min) / 1000) * tps;
    // const notes = n.notesR.map((r) => `${r.name.replace('♭', 'b').replace('♯', '#')}${r.octave}`);
    const notes = n.notesR.map((r) => r.key);
    rightTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d, wait: 'T' + ticks }));
  });

  leftNotes.forEach((n, i) => {
    const ticks = ((n.t - min) / 1000) * tps;
    // const notes = n.notesL.map((l) => `${l.name.replace('♭', 'b').replace('♯', '#')}${l.octave}`);
    const notes = n.notesL.map((l) => l.key);
    leftTrack.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: n.d, wait: 'T' + ticks }));
  });

  const write = new MidiWriter.Writer([rightTrack, leftTrack]);
  write.saveMIDI(song.title);
}
