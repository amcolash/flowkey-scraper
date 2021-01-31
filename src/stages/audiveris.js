import axios from 'axios';
import * as extract from 'extract-zip';
import { existsSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

import { appendLog } from '../renderer/Log';
import { tmpPath } from '../constants';
import { runCommand } from '../util';

const sourceUrl = 'https://github.com/Audiveris/audiveris/archive/development.zip';
const sourceZip = join(tmpPath, 'audiveris.zip');
const sourceDir = join(tmpPath, 'audiveris-development');
const buildZip = join(sourceDir, 'build/distributions/Audiveris.zip');
const toolPath = join(tmpPath, `Audiveris/bin/Audiveris${platform() === 'win32' ? '.bat' : ''}`);

export function audiverisDownload() {
  return new Promise((resolve, reject) => {
    if (existsSync(sourceZip)) {
      appendLog('Audiveris already downloaded, skipping stage');
      resolve();
    } else {
      axios
        .get(sourceUrl, { responseType: 'arraybuffer' })
        .then((response) => {
          writeFileSync(sourceZip, Buffer.from(response.data));
          resolve();
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    }
  });
}

export function audiverisBuild() {
  return new Promise(async (resolve, reject) => {
    if (existsSync(toolPath)) {
      appendLog('Audiveris already built, skipping stage');
      resolve();
      return;
    }

    await extract(sourceZip, { dir: tmpPath });

    try {
      const { stdout } = await runCommand('java --version');
      if (stdout.indexOf('JDK') === -1) throw 'No JDK installed, please install JDK 11 and retry';
    } catch (err) {
      // ERROR OUT IF NO JAVA
      console.error(err);
      appendLog({ value: err, error: true });
      reject(err);

      return;
    }

    await runCommand(platform === 'win32' ? 'gradlew.bat build' : './gradlew build', { cwd: sourceDir });
    await extract(buildZip, { dir: tmpPath });

    resolve();
  });
}
