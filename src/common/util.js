import { exec } from 'child_process';
import { error, log } from '../renderer/Log';

export function runCommand(command, options) {
  return new Promise((resolve, reject) => {
    log(command);

    const proc = exec(command, options);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      const d = data.toString().trim();
      stdout += d;
      log(d);
    });
    proc.stderr.on('data', (data) => {
      const d = data.toString().trim();
      stderr += d;
      error(d);
    });
    proc.on('exit', (code) => {
      // console.log(`Child exited with code ${code}`);
      if (code === 0) resolve({ stdout, stderr, code });
      else reject({ stdout, stderr, code });
    });
  });
}

export function getTitle(data) {
  return data.title.replace(/[^\x00-\x7F]/g, '');
}
