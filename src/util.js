import { exec } from 'child_process';

export function runCommand(command, options) {
  return new Promise((resolve, reject) => {
    const proc = exec(command, options);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      console.log(data.toString().trim());
      stdout += data.toString().trim();
    });
    proc.stderr.on('data', (data) => {
      console.error(data.toString().trim());
      stderr += data.toString().trim();
    });
    proc.on('exit', (code) => {
      console.log(`Child exited with code ${code}`);
      resolve({ stdout, stderr });
    });
  });
}
