import axios from 'axios';
import * as extract from 'extract-zip';
import { existsSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

import { log } from '../../renderer/Log';
import { tmpPath } from '../constants';
import { runCommand } from '../util';

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

      log('Checking Java Version');
      const { stdout } = await runCommand('java --version');
      if (stdout.indexOf('JDK') === -1) throw 'No JDK installed, please install JDK 11 and retry';

      await runCommand(platform === 'win32' ? 'gradlew.bat build' : './gradlew build', { cwd: sourceDir });
      await extract(buildZip, { dir: tmpPath });

      resolveMain();
    } catch (err) {
      rejectMain(err);
    }
  });
}
