import { existsSync } from 'fs';
import { join } from 'path';

import { error, log } from '../../renderer/Log';
import { isDevelopment, tmpPath } from '../constants';
import { audiverisBuild, audiverisDownload, audiverisOmr } from './audiveris';
import { downloadImages, finalImages, generateScore, generateRows, matchImages } from './images';
import { getTitle } from '../util';

export const Stage = Object.freeze({
  None: 0,
  AudiverisDownload: 1,
  AudiverisBuild: 2,
  ImageDownload: 3,
  MatchImages: 4,
  GenerateRows: 5,
  MakeFinalImages: 6,
  GenerateScore: 7,
  AudiverisOMR: 8,
  Complete: 9,
});

const delayTime = 250;
async function delay(duration) {
  await new Promise((resolve, reject) => setTimeout(() => resolve(), duration || delayTime));
}

let hasError = false;

async function runStage(data, stage, setStage, cb) {
  if (hasError) return;

  setStage(stage);
  log('-------------------------------------------------');
  log(`Stage ${stage}: ${Object.keys(Stage)[stage]}`);

  try {
    // Wait just a moment to get some animation for each stage
    await new Promise((resolve) => setTimeout(resolve, 100));

    return await cb(data);
  } catch (err) {
    hasError = true;
    console.log(JSON.stringify(err));
    const errorMessage = err.message || err;
    if (typeof errorMessage === 'string') error(errorMessage);
    setStage({ error: true });
  }
}

const skipStages = false && isDevelopment;

export async function runStages(data, setStage) {
  hasError = false;

  const title = getTitle(data);
  let xmlFile = join(tmpPath, `${title}/${title}.xml`);

  if (!existsSync(xmlFile) || !skipStages) {
    await runStage(data, Stage.AudiverisDownload, setStage, audiverisDownload);
    await runStage(data, Stage.AudiverisBuild, setStage, audiverisBuild);

    await runStage(data, Stage.ImageDownload, setStage, downloadImages);
    await runStage(data, Stage.MatchImages, setStage, matchImages);
    await runStage(data, Stage.GenerateRows, setStage, generateRows);
    await runStage(data, Stage.MakeFinalImages, setStage, finalImages);
    await runStage(data, Stage.GenerateScore, setStage, generateScore);

    xmlFile = await runStage(data, Stage.AudiverisOMR, setStage, audiverisOmr);
  }

  if (!hasError && xmlFile) {
    setStage(Stage.Complete);
    return xmlFile;
  }
}
