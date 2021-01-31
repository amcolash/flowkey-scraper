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

const delay = 100;

export async function runStages(data, setStage) {
  setStage(Stage.AudiverisDownload);
  await audiverisDownload();

  setStage(Stage.AudiverisBuild);
  await audiverisBuild();

  setStage(Stage.ImageDownload);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.MatchImages);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.GenerateRows);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.MakeFinalImage);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.AudiverisOMR);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.GenerateXML);
  await new Promise((resolve, reject) => setTimeout(() => resolve(), delay));

  setStage(Stage.Complete);
}
