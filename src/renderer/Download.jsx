import React, { useState } from 'react';
import { CheckCircle, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

const Stage = Object.freeze({
  AudiverisDownload: 1,
  AudiverisBuild: 2,
  ImageDownload: 3,
  MatchImages: 4,
  GenerateRows: 5,
  MakeFinalImage: 6,
  AudiverisOMR: 7,
  GenerateXML: 8,
});

const Green = '#36ad47';
const LightGrey = '#bbb';
const Grey = '#777';

export const Download = (props) => {
  const [stage, setStage] = useState(Stage.AudiverisDownload);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        {Object.keys(Stage).map((s) => (
          <div style={{ display: 'flex', margin: 8 }} key={s}>
            {stage === Stage[s] && <SpinnerCircularFixed size={24} thickness={200} color={Green} secondaryColor={LightGrey} />}
            {stage > Stage[s] && <CheckCircle color={Green} />}
            {stage < Stage[s] && <Watch color={Grey} />}
            <div style={{ marginLeft: 14 }}>{s.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
