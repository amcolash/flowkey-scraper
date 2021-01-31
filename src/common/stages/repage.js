const fs = require('fs');
const path = require('path');
const cv = require('opencv4nodejs');
const axios = require('axios');
const im = require('imagemagick');
const { exec } = require('child_process');
const expandHomeDir = require('expand-home-dir');
const rimraf = require('rimraf').sync;

const DEBUG = true;

const measureTemplate = {
  mat: [loadImage('./templates/measure/measure-2.png'), loadImage('./templates/measure/measure-3.png')],
  thresh: 0.2,
};

const timeSignatures = {
  time_3_4: { mat: loadImage('./templates/time-sig/3-4.png'), thresh: 0.2 },
  time_4_4: { mat: loadImage('./templates/time-sig/4-4.png'), thresh: 0.2 },
  time_6_8: { mat: loadImage('./templates/time-sig/6-8.png'), thresh: 0.2 },
};

const colors = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 0],
];

function scale(m, sx, sy) {
  return m.copy().resize(Math.floor(m.rows * sx), Math.floor(m.cols * (sy || sx)));
}

function loadImage(p) {
  return cv.imread(path.join(__dirname, p));
}

function showImage(mat) {
  if (DEBUG) cv.imshow('window', mat);
  if (DEBUG) cv.waitKey();
}

function emptyMat(rows, cols) {
  const mat = new cv.Mat(rows, cols, cv.CV_8UC3);
  mat.drawRectangle(new cv.Rect(0, 0, cols, rows), new cv.Vec3(255, 255, 255), -1);

  return mat;
}

function runCommand(command, options) {
  return new Promise((resolve, reject) => {
    const proc = exec(command, options);

    proc.stdout.on('data', (data) => console.log(data.toString().trim()));
    proc.stderr.on('data', (data) => console.error(data.toString().trim()));
    proc.on('exit', (code) => {
      console.log(`Child exited with code ${code}`);
      resolve();
    });
  });
}

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

          const args = [file, '-background', 'white', '-flatten', file];
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
    .filter(
      (p) =>
        p.indexOf(song._id) !== -1 &&
        p.indexOf('output') === -1 &&
        p.indexOf('measure') === -1 &&
        p.indexOf('row') === -1 &&
        p.indexOf('final') === -1
    )
    .map((f) => path.join(__dirname, '../tmp/', f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  await new Promise((resolve, reject) => {
    im.convert([...files, '+append', combined], (err, stdout) => {
      if (err) reject(err);
      resolve();
    });
  });
}

async function parseSong(song, outDir, audiverisPath) {
  await downloadImages(song);

  console.log('Matching images');

  const combined = loadImage(`../tmp/${song._id}_output.png`);

  const match = combined.copy();
  const matchedMeasures = getMatchedTemplates(match, { measure: measureTemplate }, true);
  const timeSigMatch = getMatchedTemplates(match, timeSignatures);

  if (Object.entries(timeSigMatch).length === 0) {
    console.error('Could not find time signature');
    process.exit(1);
  }

  const timeSig = Object.entries(timeSigMatch)[0];
  const rect = new cv.Rect(0, 0, timeSig[1].x + timeSignatures[timeSig[0]].mat.cols, combined.rows);
  const timeSigMat = combined.getRegion(rect).copy();

  const matched = matchedMeasures.measure.sort((a, b) => a.x - b.x);
  const measures = [];
  for (let i = 1; i < matched.length; i++) {
    const left = i === 1 ? 0 : matched[i - 1].x;
    const right = i === matched.length - 1 ? combined.cols : matched[i].x;

    const m = combined.getRegion(new cv.Rect(left, 0, right - left, combined.rows));
    measures.push(m);
  }

  if (measures.length === 0) {
    console.error('Could not find measures');
    process.exit(1);
  }

  console.log('Generating Rows');

  const makeCurrent = (addTimeSig) => {
    let current = emptyMat(combined.rows, maxWidth);

    if (addTimeSig) {
      timeSigMat.copyTo(current.getRegion(new cv.Rect(0, 0, timeSigMat.cols, current.rows)));
      width += timeSigMat.cols;
    }

    return current;
  };

  const maxWidth = 3500;

  let width = 0;
  const rows = [];
  let current = makeCurrent();

  for (i = 0; i < measures.length; i++) {
    const measure = measures[i];
    if (width + measure.cols > maxWidth) {
      rows.push(current);

      width = 0;
      current = makeCurrent(true);
    }

    // console.log(i, 'copying', width, rows.length);
    measure.copyTo(current.getRegion(new cv.Rect(width, 0, measure.cols, current.rows)));
    width += measure.cols;
  }

  rows.push(current);

  console.log('Making final image');

  const rowHeight = combined.rows + 100;
  const height = rows.length * rowHeight;
  const final = emptyMat(height, maxWidth);

  for (i = 0; i < rows.length; i++) {
    const rect = new cv.Rect(0, i * rowHeight, maxWidth, combined.rows);
    // console.log(final.cols, final.rows, rect);
    rows[i].copyTo(final.getRegion(rect));
  }

  // TODO: Replace all non-standard ascii chars
  const title = song.title.replace('–', '-');

  const finalFile = path.join(__dirname, `../tmp/${title}.png`);
  cv.imwrite(finalFile, final);

  console.log('Running OMR on file');

  // Remove old files if they are hanging around still
  const transcribedDir = path.join(__dirname, `../tmp/${title}`);
  rimraf(transcribedDir);

  // Actually run the OMR
  const binPath = path.join(audiverisPath, '/Audiveris');
  await runCommand(`"${binPath}" -batch -export -output "${path.join(__dirname, '../tmp')}" "${finalFile}"`);

  // Unzip the mxl
  const mxlPath = path.join(transcribedDir, `${title}.mxl`);
  await runCommand(`unzip "${mxlPath}"`, { cwd: transcribedDir });

  // Copy xml to final path
  const srcXml = path.join(transcribedDir, `${title}.xml`);
  const destXml = path.join(outDir, `${title}.xml`);

  let xml = fs.readFileSync(srcXml).toString();

  // console.log(xml);
  xml = xml.replace(
    '<identification>',
    `<work>\n<work-title>${title}</work-title>\n</work>\n<identification><creator type="composer">${song.artist}</creator>`
  );
  fs.writeFileSync(destXml, xml);
}

/** Simplified data w/o copying queries (we have everything we need already), easily added to dom button w/ tamper monkey, probably can be
 *  added to an electron app
 *
    let urlParams = new URLSearchParams(window.location.search);
    copy(
      JSON.stringify({
        images: Array.from(document.querySelectorAll('#sheet img')).map((i) => i.src.replace('/150', '/300')),
        id: window.location.pathname.replace('/player/', ''),
        title: urlParams.get('title'),
        artist: urlParams.get('artist'),
      })
    );
 *
 * {"images":["https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/0.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/1.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/2.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/3.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/4.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/5.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/6.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/7.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/8.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/9.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/10.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/11.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/12.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/13.png","https://flowkeycdn.com/sheets/Mt7YAJY3uCWHm83ka/300/14.png"],"id":"d6tbLBjcNaJMXneMH","title":"Your Song","artist":"Elton John"}
 */

const song = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/input/test5.json'))).data.song;
const outDir = expandHomeDir('~/Desktop/');
const audiverisPath = expandHomeDir('~/Desktop/Audiveris/bin');

parseSong(song, outDir, audiverisPath);
