import { exec } from 'child_process';
import { appendLog } from './renderer/Log';

export function runCommand(command, options) {
  return new Promise((resolve, reject) => {
    const proc = exec(command, options);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      const d = data.toString().trim();
      // console.log(d);
      stdout += d;
      appendLog(d);
    });
    proc.stderr.on('data', (data) => {
      const d = data.toString().trim();
      console.error(d);
      stderr += d;
      appendLog({ value: d, error: true });
    });
    proc.on('exit', (code) => {
      // console.log(`Child exited with code ${code}`);
      resolve({ stdout, stderr });
    });
  });
}
