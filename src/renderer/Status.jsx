import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

import { Colors } from '../common/constants';
import { runStages, Stage } from '../common/stages/stages';
import { Log } from './Log';

export const Status = (props) => {
  const [stage, setStage] = useState(Stage.None);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (stage === Stage.None) {
      runStages(props.data, (stage) => {
        if (stage.error) {
          setError(true);
        } else {
          setStage(stage);
        }
      });
    }
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        marginTop: 100,
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
                  color: stage < Stage[s] ? Colors.Grey : Colors.Green,
                  marginRight: 10,
                }}
              >
                {stage === Stage[s] &&
                  (error ? (
                    <AlertTriangle style={{ color: 'red' }} />
                  ) : (
                    <SpinnerCircularFixed size={22} thickness={200} color={Colors.Green} secondaryColor={Colors.LightGrey} />
                  ))}
                {stage > Stage[s] && <CheckCircle />}
                {stage < Stage[s] && <Watch />}
              </div>
              <div style={{ color: stage < Stage[s] ? Colors.LightGrey : undefined, transition: 'color 0.5s' }}>
                {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
              </div>
            </div>
          ))}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            style={{
              margin: 20,
              opacity: stage === Stage.Complete ? 1 : 0,
            }}
          >
            Save PDF
            <FileText style={{ marginLeft: 8 }} />
          </button>
        </div>
      </div>
      <Log />
    </div>
  );
};
