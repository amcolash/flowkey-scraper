import { error, log } from '../../renderer/Log';
import { audiverisBuild, audiverisDownload, audiverisOmr } from './audiveris';
import { downloadImages, finalImage, generateRows, matchImages } from './images';

export const Stage = Object.freeze({
  None: 0,
  AudiverisDownload: 1,
  AudiverisBuild: 2,
  ImageDownload: 3,
  MatchImages: 4,
  GenerateRows: 5,
  MakeFinalImage: 6,
  AudiverisOMR: 7,
  Complete: 8,
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
    return await cb(data);
  } catch (err) {
    hasError = true;
    console.log(JSON.stringify(err));
    const errorMessage = err.message || err;
    if (typeof errorMessage === 'string') error(errorMessage);
    setStage({ error: true });
  }
}

export async function runStages(data, setStage) {
  hasError = false;

  await runStage(data, Stage.AudiverisDownload, setStage, audiverisDownload);
  await runStage(data, Stage.AudiverisBuild, setStage, audiverisBuild);

  // await delay(1500);

  await runStage(data, Stage.ImageDownload, setStage, downloadImages);
  await runStage(data, Stage.MatchImages, setStage, matchImages);
  await runStage(data, Stage.GenerateRows, setStage, generateRows);
  await runStage(data, Stage.MakeFinalImage, setStage, finalImage);
  const xmlFile = await runStage(data, Stage.AudiverisOMR, setStage, audiverisOmr);

  if (!hasError) setStage(Stage.Complete);

  return xmlFile;
}
