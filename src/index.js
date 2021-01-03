const fs = require('fs');
const path = require('path');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');
const toXml = require('./build');

const DEBUG = true;

const noteTemplates = {
  dot: { mat: loadImage('./templates/dot.png'), thresh: 0.25 },
  half: { mat: [loadImage('./templates/half-bar.png'), loadImage('./templates/half-blank.png')], thresh: 0.25 },
  quarter: { mat: loadImage('./templates/quarter.png'), thresh: 0.25 },
  whole: { mat: [loadImage('./templates/whole-bar.png'), loadImage('./templates/whole-blank.png')], thresh: 0.25 },
  eighth: { mat: loadImage('./templates/eighth.png'), thresh: 0.2 },
};

const restTemplates = {
  quarter: { mat: loadImage('./templates/quarter-rest.png'), thresh: 0.2 },
};

const barsTemplate = { mat: loadImage('./templates/bars.png'), thresh: 0.2 };
const measureTemplate = { mat: loadImage('./templates/measure.png'), thresh: 0.1 };
const tieLeftTemplate = { mat: loadImage('./templates/tie-left.png'), thresh: 0.25 };
const tieRightTemplate = { mat: loadImage('./templates/tie-right.png'), thresh: 0.25 };

const timeSignatures = {
  time_3_4: { mat: loadImage('./templates/3-4.png'), thresh: 0.2 },
  time_4_4: { mat: loadImage('./templates/4-4.png'), thresh: 0.2 },
  time_6_8: { mat: loadImage('./templates/6-8.png'), thresh: 0.2 },
};

function loadImage(p) {
  return cv.imread(path.join(__dirname, p));
}

function getDuration(matches) {
  let duration = 'eighth';
  if (matches.whole) duration = 'whole';
  if (matches.half) duration = 'half';
  if (matches.quarter) duration = 'quarter';
  if (matches.eighth) duration = 'eighth';

  const rest = matches.quarterRest !== undefined;

  return { duration, dot: matches.dot !== undefined, tie: false, rest };
}

function getTimeSignature(matches) {
  if (matches.time_3_3) return { top: 3, bottom: 4 };
  if (matches.time_4_4) return { top: 4, bottom: 4 };
  if (matches.time_6_8) return { top: 6, bottom: 8 };
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

  const combined = path.join(__dirname, '../tmp/output.png');
  if (fs.existsSync(combined)) fs.unlinkSync(combined);
  const files = fs
    .readdirSync(path.join(__dirname, '../tmp/'))
    .map((f) => path.join(__dirname, '../tmp/', f))
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

    const templates = Array.isArray(value.mat) ? value.mat : [value.mat];

    templates.forEach((t) => {
      const match = mat.matchTemplate(t, cv.TM_CCOEFF_NORMED);

      if (!multi) {
        const minMax = match.minMaxLoc();
        // if (DEBUG) console.log(name, minMax);

        if (minMax.maxVal > 1 - value.thresh) {
          matches[name] = { x: minMax.maxLoc.x, y: minMax.maxLoc.y };

          // if (DEBUG) console.log(name, minMax);
          if (DEBUG) mat.drawRectangle(new cv.Rect(minMax.maxLoc.x, minMax.maxLoc.y, t.cols, t.rows), new cv.Vec3(0, 0, 255), 2, cv.LINE_8);
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
                mat.drawRectangle(new cv.Rect(x, y, t.cols, t.rows), new cv.Vec3(0, 0, 255), 2, cv.LINE_8);
              }
            }
          }
        }
      }
    });
  });

  return matches;
}

function checkTies(mat, note, augmentedNotes) {
  let xPos = note.x * 2 - 15;
  let moreTies = true;

  while (moreTies) {
    moreTies = false;

    let tieLeftBar = false;
    let tieRightBar = false;

    let augmentedNoteX = -1;

    const halfHeight = mat.rows / 2;

    const cropped = mat.getRegion(new cv.Rect(xPos, 0, 65, mat.rows)).copy();
    const leftBar = cropped.getRegion(new cv.Rect(0, halfHeight, cropped.cols, halfHeight));
    const rightBar = cropped.getRegion(new cv.Rect(0, 0, cropped.cols, halfHeight));

    [leftBar, rightBar].forEach((bar, j) => {
      const leftTieMatch = getMatchedTemplates(bar, { tieLeft: tieLeftTemplate });

      if (leftTieMatch.tieLeft) {
        const cropOffset = xPos + 40;

        let newCrop;
        if (j === 0) newCrop = mat.getRegion(new cv.Rect(cropOffset, halfHeight, 250, halfHeight)).copy();
        else newCrop = mat.getRegion(new cv.Rect(cropOffset, 0, 250, halfHeight)).copy();

        const matchMat = newCrop.copy();
        const bothTieMatch = getMatchedTemplates(matchMat, { tieRight: tieRightTemplate, tieLeft: tieLeftTemplate });
        if (bothTieMatch.tieRight) {
          // if (DEBUG) cv.imshow('window', newCrop);
          // if (DEBUG) cv.waitKey();

          const rightCrop = newCrop.getRegion(
            new cv.Rect(bothTieMatch.tieRight.x + 10, 0, Math.min(65, newCrop.cols - bothTieMatch.tieRight.x - 10), newCrop.rows)
          );

          const tieMatch = getMatchedTemplates(rightCrop, noteTemplates);
          const extraDuration = getDuration(tieMatch);

          if (j === 0) {
            tieLeftBar = extraDuration;
            augmentedNoteX = cropOffset + bothTieMatch.tieLeft.x + 10;
          }

          if (j === 1) {
            tieRightBar = extraDuration;
            augmentedNoteX = cropOffset + bothTieMatch.tieRight.x + 10;
          }
        }

        if (bothTieMatch.tieLeft) {
          // if (DEBUG) cv.imshow('window', newCrop);
          // if (DEBUG) cv.waitKey();
          xPos += bothTieMatch.tieLeft.x + 15;
          moreTies = true;
        }
      }
    });

    if (tieLeftBar || tieRightBar) {
      if (tieLeftBar) note.notesL.forEach((n) => (n.duration.tieStart = true));
      if (tieRightBar) note.notesR.forEach((n) => (n.duration.tieStart = true));

      const newNote = JSON.parse(JSON.stringify(note));
      newNote.x = augmentedNoteX / 2;

      if (tieLeftBar) newNote.notesL.forEach((n) => (n.duration = { ...tieLeftBar, tieStop: true, tieStart: moreTies }));
      if (tieRightBar) newNote.notesR.forEach((n) => (n.duration = { ...tieRightBar, tieStop: true, tieStart: moreTies }));

      augmentedNotes.push(newNote);
    }
  }
}

function addRests(mat, augmentedNotes) {
  const leftBar = mat.getRegion(new cv.Rect(0, mat.rows / 2, mat.cols, mat.rows / 2)).copy();
  const rightBar = mat.getRegion(new cv.Rect(0, 0, mat.cols, mat.rows / 2)).copy();

  [leftBar, rightBar].forEach((bar, i) => {
    const matchedRests = getMatchedTemplates(bar.copy(), restTemplates, true);

    const filteredRests = [];
    Object.keys(matchedRests).forEach((restKey) => {
      matchedRests[restKey].forEach((r) => {
        let duplicate = false;
        filteredRests.forEach((f) => {
          if (Math.abs(r.x / 2 - f.x) < 50) duplicate = true;
        });
        if (!duplicate) filteredRests.push({ x: r.x / 2, y: r.y / 2 });
      });
    });

    filteredRests.forEach((r) => {
      let insertPoint = -1;

      for (let i = 0; i < augmentedNotes.length - 1; i++) {
        if (r.x > augmentedNotes[i].x && r.x < augmentedNotes[i + 1].x) insertPoint = i + 1;
      }

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
}

function getMeasures(mat, notes) {
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
      return { i, x1: m.x, x2: i < filteredMeasure.length - 1 ? filteredMeasure[i + 1].x : mat.cols, staffs: [[], []] };
    });

  notes.forEach((n) => {
    const measure = findMeasure(n.x * 2, measures);
    measures[measure].staffs[0].push(n.notesR);
    measures[measure].staffs[1].push(n.notesL);
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

  const mat = loadImage('../tmp/output.png');
  const halfHeight = mat.rows / 2;

  const augmentedNotes = [];

  // Iterate through each note to get durations and add in missing tied notes
  for (let i = 0; i < notes.length; i++) {
    // for (let i = 0; i < 14; i++) {
    const cropped = mat.getRegion(new cv.Rect(notes[i].x * 2 - 15, 0, 65, mat.rows)).copy();

    const leftBar = cropped.getRegion(new cv.Rect(0, halfHeight, cropped.cols, halfHeight));
    const rightBar = cropped.getRegion(new cv.Rect(0, 0, cropped.cols, halfHeight));

    // Get note durations
    const leftBarMatch = getMatchedTemplates(leftBar, noteTemplates);
    const leftBarDuration = getDuration(leftBarMatch);
    notes[i].notesL.forEach((n) => (n.duration = leftBarDuration));

    const rightBarMatch = getMatchedTemplates(rightBar, noteTemplates);
    const rightBarDuration = getDuration(rightBarMatch);
    notes[i].notesR.forEach((n) => (n.duration = rightBarDuration));

    augmentedNotes.push(notes[i]);

    // Add additional notes for ties
    checkTies(mat, notes[i], augmentedNotes);
  }

  // if (DEBUG) console.log(notes.length, augmentedNotes.length);

  // Add missing rests
  addRests(mat, augmentedNotes);

  // Segment notes into measures
  const measures = getMeasures(mat.copy(), augmentedNotes);
  const timeSig = getMatchedTemplates(mat, timeSignatures);

  const xml = toXml(measures, { title: song.title, artist: song.artist, timeSig: getTimeSignature(timeSig) });
  fs.writeFileSync(path.join(__dirname, '../test.xml'), xml);
}

// Init and parse song
if (process.argv.length !== 3) {
  console.error('usage: node index.js [json file]');
  return;
}

console.log('Processing', process.argv[2]);

const song = JSON.parse(fs.readFileSync(process.argv[2]).toString()).data.song;
parseSong(song);
