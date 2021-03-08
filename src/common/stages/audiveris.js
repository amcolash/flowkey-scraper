import axios from 'axios';
import * as extract from 'extract-zip';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';
import rimraf from 'rimraf';

import { log } from '../../renderer/Log';
import { tmpPath } from '../constants';
import { getTitle, runCommand } from '../util';
import { imageDir } from './images';

const sourceUrl = 'https://github.com/Audiveris/audiveris/archive/development.zip';
const sourceZip = join(tmpPath, 'audiveris.zip');
const sourceDir = join(tmpPath, 'audiveris-development');
const buildZip = join(sourceDir, 'build/distributions/Audiveris.zip');
const toolPath = join(tmpPath, `Audiveris/bin/Audiveris${platform() === 'win32' ? '.bat' : ''}`);

export function audiverisDownload() {
  return new Promise((resolveMain, rejectMain) => {
    try {
      if (existsSync(sourceZip)) {
        log('Audiveris already downloaded, skipping stage');
        resolveMain();
      } else {
        axios
          .get(sourceUrl, { responseType: 'arraybuffer' })
          .then((response) => {
            writeFileSync(sourceZip, Buffer.from(response.data));
            resolveMain();
          })
          .catch((err) => {
            rejectMain(err);
          });
      }
    } catch (err) {
      rejectMain(err);
    }
  });
}

async function checkJava() {
  log('Checking Java Version');
  const javaVersion = await runCommand('java -version');
  const javaVersionCombined = javaVersion.stdout + '\n' + javaVersion.stderr;
  if (javaVersionCombined.indexOf('11.') === -1) throw `Invalid version of JDK (java -version)\nPlease install JDK 11 and retry`;

  // Make sure there is a java compiler, can't seem to always get the proper version reliably on all platforms so just make sure it exists
  await runCommand('javac -version');
}

export function audiverisBuild() {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      if (existsSync(toolPath)) {
        log('Audiveris already built, skipping stage');
        resolveMain();
        return;
      }

      await extract(sourceZip, { dir: tmpPath });
      await checkJava();

      // Fix build.gradle file so that it doesn't need git
      const buildGradle = join(sourceDir, 'build.gradle');
      let build = readFileSync(buildGradle).toString();
      build = build.replace('dependsOn: git_build', '') + `\next.programBuild = '${new Date().toLocaleString()}'`;
      writeFileSync(buildGradle, build);

      // Disable tesseract OCR
      const tesseractOCR = join(sourceDir, 'src/main/org/audiveris/omr/text/tesseract/TesseractOCR.java');
      let tesseract = readFileSync(tesseractOCR).toString();
      tesseract = tesseract.replace(/useOCR = new Constant.Boolean\(\s*true/, 'useOCR = new Constant.Boolean(\nfalse');
      writeFileSync(tesseractOCR, tesseract);

      log('Building audiveris', sourceDir);
      await runCommand(platform() === 'win32' ? 'gradlew.bat build' : './gradlew build', { cwd: sourceDir });
      await extract(buildZip, { dir: tmpPath });

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}

export function audiverisOmr(data) {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      const title = getTitle(data);
      const finalFile = join(imageDir, `${title}.png`);

      // Remove old files if they are hanging around still
      const transcribedDir = join(tmpPath, title);
      rimraf.sync(transcribedDir);

      await checkJava();

      // Actually run the OMR
      const { stdin } = await runCommand(`"${toolPath}" -batch -export -output "${tmpPath}" "${finalFile}"`);

      if (typeof stdin === 'string' && stdin.indexOf('Exception') !== -1) {
        rejectMain();
        return;
      }

      // Unzip the mxl
      const mxlPath = join(transcribedDir, `${title}.mxl`);
      await extract(mxlPath, { dir: transcribedDir });

      // Copy xml to final path
      const xmlFile = join(transcribedDir, `${title}.xml`);

      let xml = readFileSync(xmlFile).toString();

      xml = xml
        .replace(
          '<identification>',
          `<work>\n<work-title>${title}</work-title>\n</work>\n<identification>\n<creator type="composer">${data.artist}</creator>`
        )
        .replace(/<direction-type>.+?<\/direction-type>/gs, '')
        .replace(/<direction>.+?<\/direction>/gs, '')
        .replace(/<part-name>.+?<\/part-name>/gs, '');

      writeFileSync(xmlFile, xml);

      resolveMain(xmlFile);
    } catch (err) {
      rejectMain(err);
    }
  });
}
