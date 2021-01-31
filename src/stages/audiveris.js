import axios from 'axios';
import * as extract from 'extract-zip';
import { existsSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

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
      resolve();
    } else {
      if (platform() === 'win32') url = windowsUrl;

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
      resolve();
    }

    await extract(sourceZip, { dir: tmpPath });

    try {
      const { stdout } = await runCommand('java --version');
      if (stdout.indexOf('JDK') === -1) throw 'No JDK installed, please install JDK 11 and retry';
    } catch (err) {
      // ERROR OUT IF NO JAVA
      console.error(err);
      reject(err);
    }

    await runCommand(platform === 'win32' ? 'gradlew.bat build' : './gradlew build', { cwd: sourceDir });
    await extract(buildZip, { dir: tmpPath });

    resolve();
  });
}
