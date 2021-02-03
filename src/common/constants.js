import { remote } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const Colors = {
  Green: '#36ad47',
  LightGrey: '#bbb',
  Grey: '#777',
  Charcoal: '#333',
};

export const tmpPath = join(remote.app.getPath('userData'), 'tmp');
console.log('tmpPath', tmpPath);
if (!existsSync(tmpPath)) mkdirSync(tmpPath);

export const isDevelopment = process.env.NODE_ENV !== 'production';
