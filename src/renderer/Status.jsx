import React, { useEffect, useState } from 'react';
import { CheckCircle, FileText, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

import { Green, Grey, LightGrey } from '../constants';
import { runStages, Stage } from '../stages/stages';

export const Status = (props) => {
  const [stage, setStage] = useState(Stage.None);

  useEffect(() => {
    if (stage === Stage.None) {
      runStages(props.data, setStage);
    }
  });

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div>
        {Object.keys(Stage)
          .filter((s) => Stage[s] !== Stage.None && Stage[s] != Stage.Complete)
          .map((s) => (
            <div style={{ display: 'flex', margin: 8 }} key={s}>
              <div
                style={{
                  width: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: stage < Stage[s] ? Grey : Green,
                  marginRight: 10,
                }}
              >
                {stage === Stage[s] && <SpinnerCircularFixed size={22} thickness={200} color={Green} secondaryColor={LightGrey} />}
                {stage > Stage[s] && <CheckCircle />}
                {stage < Stage[s] && <Watch />}
              </div>
              <div style={{ color: stage < Stage[s] ? LightGrey : undefined, transition: 'color 0.5s' }}>
                {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
              </div>
            </div>
          ))}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            style={{
              marginTop: 20,
              opacity: stage === Stage.Complete ? 1 : 0,
            }}
          >
            Save PDF
            <FileText style={{ marginLeft: 8 }} />
          </button>
        </div>
      </div>
    </div>
  );
};
