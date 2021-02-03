import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Home, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

import { Colors } from '../common/constants';
import { runStages, Stage } from '../common/stages/stages';

import { Score } from './Score';
import { Log } from './Log';

export const Status = (props) => {
  const [stage, setStage] = useState(Stage.None);
  const [error, setError] = useState(false);
  const [xmlFile, setXmlFile] = useState();

  useEffect(async () => {
    if (stage === Stage.None) {
      const xmlFile = await runStages(props.data, (stage) => {
        if (stage.error) {
          setError(true);
        } else {
          setStage(stage);
        }
      });

      setXmlFile(xmlFile);
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
        marginTop: stage !== Stage.Complete ? 100 : undefined,
      }}
    >
      <button onClick={() => props.setData(undefined)} style={{ position: 'absolute', top: 10, left: 10 }}>
        <Home />
      </button>
      {stage !== Stage.Complete && (
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
        </div>
      )}
      <Score xmlFile={xmlFile} />
      <Log />
    </div>
  );
};
