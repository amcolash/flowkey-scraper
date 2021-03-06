import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Home, Trash, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

import { Colors, isDevelopment, tmpPath } from '../common/constants';
import { runStages, Stage } from '../common/stages/stages';

import { Score } from './Score';
import { clearLog, Log } from './Log';
import { remote } from 'electron';
import rimraf from 'rimraf';

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
      <button
        disabled={stage !== Stage.Complete && !error}
        onClick={() => {
          clearLog();
          const current = remote.getCurrentWindow();
          if (current) {
            current.reload();
            // Even if sample data used, can still debug
            sessionStorage.setItem('flowkey-home', true);
          }
        }}
        style={{ position: 'absolute', top: 10, left: 10 }}
      >
        <Home />
      </button>
      {stage !== Stage.Complete && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ overflowX: 'auto', maxWidth: '95vw' }}>
            {isDevelopment && (
              <div>
                {/* Lots of test divs for checking rows */}
                <canvas id="test" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test0" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test1" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test2" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test3" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test4" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test5" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test6" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test7" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test8" width="0" height="0" style={{ border: '1px solid black' }} />
                <canvas id="test9" width="0" height="0" style={{ border: '1px solid black' }} />
              </div>
            )}
          </div>
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
                        <AlertTriangle style={{ color: Colors.Red }} />
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
        </div>
      )}
      <Score xmlFile={xmlFile} data={props.data} />
      <button
        disabled={stage !== Stage.Complete && !error}
        onClick={() => {
          const option = remote.dialog.showMessageBoxSync({
            buttons: ['Cancel', 'Ok'],
            message: 'Are you sure you want to clear temp cache?',
          });
          if (option === 1) {
            clearLog();
            rimraf.sync(tmpPath);
            const current = remote.getCurrentWindow();
            if (current) current.reload();
          }
        }}
        style={{ position: 'absolute', bottom: 10, right: 60 }}
      >
        <Trash />
      </button>
      <Log />
    </div>
  );
};
