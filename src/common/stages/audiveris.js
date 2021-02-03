import axios from 'axios';
import * as extract from 'extract-zip';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';
import rimraf from 'rimraf';

import { log } from '../../renderer/Log';
import { tmpPath } from '../constants';
import { runCommand } from '../util';
import { getTitle, imageDir } from './images';

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

export function audiverisBuild() {
  return new Promise(async (resolveMain, rejectMain) => {
    try {
      if (existsSync(toolPath)) {
        log('Audiveris already built, skipping stage');
        resolveMain();
        return;
      }

      await extract(sourceZip, { dir: tmpPath });

      // Fix build.gradle file so that it doesn't need git
      const buildGradle = join(sourceDir, 'build.gradle');
      let build = readFileSync(buildGradle).toString();
      build = build.replace('dependsOn: git_build', '') + `\next.programBuild = '${new Date().toLocaleString()}'`;
      writeFileSync(buildGradle, build);

      log('Checking Java Version');
      const { stdout } = await runCommand('java --version');
      if (stdout.indexOf('JDK') === -1) throw 'No JDK installed, please install JDK 11 and retry';

      console.log(sourceDir);
      await runCommand(platform === 'win32' ? 'gradlew.bat build' : './gradlew build', { cwd: sourceDir });
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

      // Actually run the OMR
      await runCommand(`"${toolPath}" -batch -export -output "${tmpPath}" "${finalFile}"`);

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
