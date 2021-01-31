import { appendLog } from '../renderer/Log';
import { audiverisBuild, audiverisDownload } from './audiveris';

export const Stage = Object.freeze({
  None: 0,
  AudiverisDownload: 1,
  AudiverisBuild: 2,
  ImageDownload: 3,
  MatchImages: 4,
  GenerateRows: 5,
  MakeFinalImage: 6,
  AudiverisOMR: 7,
  GenerateXML: 8,
  Complete: 9,
});

const delayTime = 250;
async function delay() {
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delayTime));
}

async function runStage(data, stage, setStage, cb) {
  setStage(stage);
  appendLog({ key: Math.random(), value: '-------------------------------------------------' });
  appendLog(`Stage ${stage}: ${Object.keys(Stage)[stage]}`);
  await cb(data);
}

export async function runStages(data, setStage) {
  await delay(); // slight delay since log hasn't mounted - there definitely has to be a better route

  await runStage(data, Stage.AudiverisDownload, setStage, audiverisDownload);
  await runStage(data, Stage.AudiverisBuild, setStage, audiverisBuild);

  await runStage(data, Stage.ImageDownload, setStage, delay);
  await runStage(data, Stage.MatchImages, setStage, delay);
  await runStage(data, Stage.GenerateRows, setStage, delay);
  await runStage(data, Stage.MakeFinalImage, setStage, delay);
  await runStage(data, Stage.AudiverisOMR, setStage, delay);
  await runStage(data, Stage.GenerateXML, setStage, delay);

  setStage(Stage.Complete);
}
