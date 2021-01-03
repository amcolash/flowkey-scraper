const fs = require('fs');
const path = require('path');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');
const toXml = require('./build');

const DEBUG = true;

const notesNoExtrasTemplates = {
  half: { mat: [loadImage('./templates/notes/half/half-bar.png'), loadImage('./templates/notes/half/half-blank.png')], thresh: 0.25 },
  quarter: { mat: loadImage('./templates/notes/quarter/quarter.png'), thresh: 0.25 },
  whole: { mat: [loadImage('./templates/notes/whole/whole-bar.png'), loadImage('./templates/notes/whole/whole-blank.png')], thresh: 0.25 },
  eighth: {
    mat: [
      loadImage('./templates/notes/eighth/eighth.png'),
      loadImage('./templates/notes/eighth/eighth-2.png'),
      loadImage('./templates/notes/eighth/eighth-3.png'),
      loadImage('./templates/notes/eighth/eighth-bottom.png'),
      loadImage('./templates/notes/eighth/eighth-bottom-2.png'),
    ],
    thresh: 0.2,
  },
};

const noteTemplates = {
  ...notesNoExtrasTemplates,
  dot: { mat: loadImage('./templates/notes/dot.png'), thresh: 0.25 },
  eighthBeam: {
    mat: generateVariations([
      loadImage('./templates/notes/eighth/eighth-beam-1.png'),
      loadImage('./templates/notes/eighth/eighth-beam-2.png'),
    ]),
    thresh: 0.35,
  },
  eighthBeamEnd: {
    mat: generateVariations([
      loadImage('./templates/notes/eighth/eighth-beam-end-1.png'),
      loadImage('./templates/notes/eighth/eighth-beam-end-2.png'),
      loadImage('./templates/notes/eighth/eighth-beam-end-3.png'),
      loadImage('./templates/notes/eighth/eighth-beam-end-4.png'),
    ]),
    thresh: 0.15,
  },
};

const restTemplates = {
  quarter: { mat: loadImage('./templates/rests/quarter-rest.png'), thresh: 0.2 },
  eighth: { mat: loadImage('./templates/rests/eighth-rest.png'), thresh: 0.2 },
};

const barsTemplate = { mat: loadImage('./templates/bars/bars.png'), thresh: 0.2 };
const measureTemplate = { mat: loadImage('./templates/bars/measure.png'), thresh: 0.1 };

const tieLeftTemplate = {
  mat: generateVariations([
    loadImage('./templates/ties/tie-short.png'),
    loadImage('./templates/ties/tie-long.png'),
    loadImage('./templates/ties/tie-bar.png'),
  ]),
  thresh: 0.25,
};

const timeSignatures = {
  time_3_4: { mat: loadImage('./templates/time-sig/3-4.png'), thresh: 0.2 },
  time_4_4: { mat: loadImage('./templates/time-sig/4-4.png'), thresh: 0.2 },
  time_6_8: { mat: loadImage('./templates/time-sig/6-8.png'), thresh: 0.2 },
};

function generateVariations(mats) {
  const variations = [];
  mats.forEach((m) => {
    variations.push(m);
    variations.push(m.copy().flip(0));
  });

  return variations;
}

function scale(m, sx, sy) {
  return m.copy().resize(Math.floor(m.rows * sx), Math.floor(m.cols * (sy || sx)));
}

function loadImage(p) {
  return cv.imread(path.join(__dirname, p));
}

function getDuration(matches) {
  let duration = 'eighth';
  if (matches.whole) duration = 'whole';
  if (matches.half) duration = 'half';
  if (matches.quarter) duration = 'quarter';
  if (matches.eighth || matches.eighthBeam) duration = 'eighth';

  let beam;
  if (matches.eighthBeam) beam = 'begin';
  if (matches.eighthBeamEnd) beam = 'end';

  const rest = matches.quarterRest !== undefined || matches.eighthRest !== undefined;

  return { duration, dot: matches.dot !== undefined, tieStart: false, tieStop: false, rest, beam };
}

function getTimeSignature(matches) {
  if (matches.time_3_3) return { top: 3, bottom: 4 };
  if (matches.time_4_4) return { top: 4, bottom: 4 };
  if (matches.time_6_8) return { top: 6, bottom: 8 };
}

async function downloadImages(song) {
  console.log('Downloading Images');

  if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');

  const imgs = song.musicsheets.imageURLs2x.map((i) => {
    return new Promise((resolve, reject) => {
      const file = path.join('tmp', `${song._id}_${path.basename(i)}`);
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

  const combined = path.join(__dirname, `../tmp/${song._id}_output.png`);
  if (fs.existsSync(combined)) fs.unlinkSync(combined);
  const files = fs
    .readdirSync(path.join(__dirname, '../tmp/'))
    .filter((p) => p.indexOf(song._id) !== -1 && p.indexOf('output') === -1)
    .map((f) => path.join(__dirname, '../tmp/', f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  await new Promise((resolve, reject) => {
    im.convert([...files, '+append', combined], (err, stdout) => {
      if (err) reject(err);
      resolve();
    });
  });
}

const colors = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 0],
];

function getMatchedTemplates(mat, templates, multi) {
  const matches = {};
  const pristine = mat.copy();

  Object.entries(templates).forEach((template, i) => {
    const name = template[0];
    const value = template[1];

    const templates = Array.isArray(value.mat) ? value.mat : [value.mat];

    templates.forEach((t, j) => {
      const match = pristine.matchTemplate(t, cv.TM_CCOEFF_NORMED);
      const color = colors[((i + 1) * (j + 1)) % colors.length];

      if (!multi) {
        const minMax = match.minMaxLoc();
        // if (DEBUG) console.log(name, minMax);

        if (minMax.maxVal > 1 - value.thresh) {
          matches[name] = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };

          if (DEBUG) {
            // console.log(name, minMax);
            mat.drawRectangle(
              new cv.Rect(minMax.maxLoc.x, minMax.maxLoc.y, t.cols, t.rows),
              new cv.Vec3(color[0], color[1], color[2]),
              2,
              cv.LINE_8
            );
          }
        }
      } else {
        const dataList = match.getDataAsArray();
        if (!matches[name]) matches[name] = [];

        const tmpMatches = [];
        for (let y = 0; y < dataList.length; y++) {
          for (let x = 0; x < dataList[y].length; x++) {
            if (dataList[y][x] > 1 - value.thresh) {
              tmpMatches.push({ x, y });
            }
          }
        }

        // Filter out duplicates
        const filteredResults = [...matches[name]];
        tmpMatches.forEach((m) => {
          let duplicate = false;
          filteredResults.forEach((f) => {
            if (Math.abs(m.x - f.x) < 50) duplicate = true;
          });
          if (!duplicate) {
            filteredResults.push(m);

            if (DEBUG) {
              // console.log(name, m);
              mat.drawRectangle(new cv.Rect(m.x, m.y, t.cols, t.rows), new cv.Vec3(color[0], color[1], color[2]), 2, cv.LINE_8);
            }
          }
        });

        matches[name] = filteredResults;
      }
    });
  });

  return matches;
}

function addTiedNotes(mat, notes, augmentedNotes) {
  console.log('Adding Tied Notes');

  const leftBar = mat.getRegion(new cv.Rect(0, mat.rows / 2, mat.cols, mat.rows / 2));
  const rightBar = mat.getRegion(new cv.Rect(0, 0, mat.cols, mat.rows / 2));

  const leftNotes = [];
  const rightNotes = [];
  augmentedNotes.forEach((n) => {
    if (n.notesL.length > 0) leftNotes.push(n);
    if (n.notesR.length > 0) rightNotes.push(n);
  });

  [leftBar, rightBar].forEach((bar, i) => {
    const barMatch = bar.copy();
    const matchedNotes = getMatchedTemplates(barMatch, notesNoExtrasTemplates, true);

    const combined = [];
    Object.keys(matchedNotes).forEach((duration) => {
      matchedNotes[duration].forEach((m) => {
        let skip = false;
        notes.forEach((n) => {
          if (Math.abs(n.x - m.x / 2) < 30) {
            if (i === 0 && n.notesL.length !== 0) skip = true;
            if (i === 1 && n.notesR.length !== 0) skip = true;
          }
        });
        if (!skip) combined.push(m);
      });
    });
    const sorted = combined.sort((a, b) => a.x - b.x);

    // if (DEBUG) cv.imshow('window', barMatch);
    // if (DEBUG) cv.waitKey();

    sorted.forEach((m) => {
      let insertPoint = -1;

      const n = { x: m.x / 2, y: m.y / 2 };

      for (let j = 0; j < augmentedNotes.length - 1; j++) {
        const note = augmentedNotes[j];
        const nextNote = augmentedNotes[j + 1];
        if (n.x >= note.x && n.x < nextNote.x) insertPoint = j + 1;
      }

      if (n.x > augmentedNotes[augmentedNotes.length - 1].x) insertPoint = augmentedNotes.length;

      if (insertPoint > 0) {
        const cropped = bar.getRegion(new cv.Rect(n.x * 2 - 40, 0, 100, bar.rows)).copy();

        const noteMatch = getMatchedTemplates(cropped, {
          ...noteTemplates,
          tieLeft: tieLeftTemplate,
        });
        const duration = getDuration(noteMatch);

        let previousNote = -1;
        const barNotes = i === 0 ? leftNotes : rightNotes;
        for (let j = 0; j < barNotes.length - 1; j++) {
          if (n.x >= barNotes[j].x && n.x < barNotes[j + 1].x) previousNote = j;
        }
        if (n.x > barNotes[barNotes.length - 1].x) previousNote = barNotes.length - 1;

        // if (DEBUG) cv.imshow('window', cropped);
        // if (DEBUG) cv.waitKey();

        // console.log(barNotes.length, previousNote);

        if (noteMatch.tieLeft) duration.tieStart = true;

        duration.tieStop = true;
        if (i === 0) barNotes[previousNote].notesL.forEach((n) => (n.duration.tieStart = true));
        if (i === 1) barNotes[previousNote].notesR.forEach((n) => (n.duration.tieStart = true));

        const notes = JSON.parse(JSON.stringify(i === 0 ? [...barNotes[previousNote].notesL] : [...barNotes[previousNote].notesR]));
        notes.forEach((n) => (n.duration = duration));

        const note = { ...n, notesL: i === 0 ? notes : [], notesR: i === 1 ? notes : [] };
        augmentedNotes.splice(insertPoint, 0, note);
      }
    });
  });
}

function addRests(mat, augmentedNotes) {
  console.log('Adding Rests');

  const leftBar = mat.getRegion(new cv.Rect(0, mat.rows / 2, mat.cols, mat.rows / 2)).copy();
  const rightBar = mat.getRegion(new cv.Rect(0, 0, mat.cols, mat.rows / 2)).copy();

  [leftBar, rightBar].forEach((bar, i) => {
    const matchedBar = bar.copy();
    const matchedRests = getMatchedTemplates(matchedBar, restTemplates, true);

    Object.keys(matchedRests).forEach((restKey) => {
      matchedRests[restKey].forEach((rest) => {
        let insertPoint = -1;

        const r = { x: rest.x / 2, y: rest.y / 2 };

        for (let i = 0; i < augmentedNotes.length - 1; i++) {
          if (r.x > augmentedNotes[i].x && r.x < augmentedNotes[i + 1].x) insertPoint = i + 1;
        }
        if (r.x < augmentedNotes[0].x) insertPoint = 0;
        if (r.x > augmentedNotes[augmentedNotes.length - 1].x) insertPoint = augmentedNotes.length;

        if (insertPoint !== -1) {
          const cropped = bar.getRegion(new cv.Rect(r.x * 2 - 15, 0, 65, bar.rows)).copy();

          const restMatch = getMatchedTemplates(cropped, { ...restTemplates, dot: { ...noteTemplates.dot } });
          const duration = getDuration(restMatch);
          const notes = [{ rest: true, duration }];
          const rest = { ...r, notesL: i === 0 ? notes : [], notesR: i === 1 ? notes : [] };

          augmentedNotes.splice(insertPoint, 0, rest);
        }
      });
    });
  });
}

function getMeasures(mat, notes) {
  console.log('Generating Measures');

  const rightBar = mat.getRegion(new cv.Rect(0, 0, mat.cols, mat.rows / 2));
  const rightBarMatch = getMatchedTemplates(rightBar.copy(), { bars: barsTemplate });
  const rightCrop = rightBar.getRegion(new cv.Rect(0, rightBarMatch.bars.y, mat.cols, barsTemplate.mat.rows));
  const rightMeasure = getMatchedTemplates(rightCrop, { measure: measureTemplate }, true);

  // Add first measure
  rightMeasure.measure.push({ x: 0, y: rightMeasure.measure[0].y });

  const sorted = rightMeasure.measure.sort((a, b) => a.x - b.x);
  const measures = sorted.map((m, i) => {
    return { i, x1: m.x, x2: i < sorted.length - 1 ? sorted[i + 1].x : mat.cols, staffs: [[], []] };
  });

  notes.forEach((n) => {
    const measure = findMeasure(n.x * 2, measures);
    measures[measure].staffs[0].push(n.notesR);
    measures[measure].staffs[1].push(n.notesL);
  });

  const filteredMeasures = [];
  measures.forEach((m, i) => {
    // if (i < 15 || i > 20) return;
    if (m.staffs[0].length > 0 || m.staffs[1].length > 0) filteredMeasures.push(m);
  });

  return filteredMeasures;
}

// 0-indexed position
function findMeasure(x, measures) {
  for (let i = 0; i < measures.length; i++) {
    if (x > measures[i].x1 && x <= measures[i].x2) return i;
  }

  return -1;
}

async function parseSong(song, output) {
  const notes = song.noteEvents;

  await downloadImages(song);

  const mat = loadImage(`../tmp/${song._id}_output.png`);
  const halfHeight = mat.rows / 2;

  const augmentedNotes = [];

  // Iterate through each note to get durations and add in missing tied notes
  console.log('Adding Note Durations');

  for (let i = 0; i < notes.length; i++) {
    // for (let i = 75; i < 95; i++) {
    const cropped = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, 0, 85, mat.rows)).copy();

    const leftBar = cropped.getRegion(new cv.Rect(0, halfHeight, cropped.cols, halfHeight));
    const rightBar = cropped.getRegion(new cv.Rect(0, 0, cropped.cols, halfHeight));

    // Get note durations
    const leftBarMatch = getMatchedTemplates(leftBar, noteTemplates);
    const leftBarDuration = getDuration(leftBarMatch);
    notes[i].notesL.forEach((n) => (n.duration = leftBarDuration));

    const rightBarMatch = getMatchedTemplates(rightBar, noteTemplates);
    const rightBarDuration = getDuration(rightBarMatch);
    notes[i].notesR.forEach((n) => (n.duration = rightBarDuration));

    // if (DEBUG) cv.imshow('window', rightBar);
    // if (DEBUG) cv.waitKey();

    augmentedNotes.push(notes[i]);
  }

  // Add missing notes that are tied
  addTiedNotes(mat, notes, augmentedNotes);

  // if (DEBUG) console.log(notes.length, augmentedNotes.length);

  // Add missing rests
  addRests(mat, augmentedNotes);

  // Segment notes into measures
  const measures = getMeasures(mat.copy(), augmentedNotes);
  const timeSig = getMatchedTemplates(mat, timeSignatures);

  const xml = toXml(measures, { title: song.title, artist: song.artist, timeSig: getTimeSignature(timeSig) });
  if (output) fs.writeFileSync(output, xml);

  return xml;
}

module.exports = parseSong;
