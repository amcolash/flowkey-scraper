import { remote } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const Colors = {
  Green: '#36ad47',
  LightGrey: '#bbb',
  Grey: '#777',
  Charcoal: '#333',
};

export const appPath = remote.app.getAppPath();
export const tmpPath = join(remote.app.getAppPath(), 'tmp');

if (!existsSync(tmpPath)) mkdirSync(tmpPath);
