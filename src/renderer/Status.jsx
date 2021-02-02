import { fstat, readFileSync, writeFileSync } from 'fs';
import { remote } from 'electron';
import { basename } from 'path';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Code, FileText, Watch } from 'react-feather';
import { SpinnerCircularFixed } from 'spinners-react';

import NFClient from '../common/nfclient';
import { Colors } from '../common/constants';
import { runStages, Stage } from '../common/stages/stages';

import { Log } from './Log';

let score;

export const Status = (props) => {
  const [stage, setStage] = useState(Stage.None);
  const [error, setError] = useState(false);
  const [xmlFile, setXmlFile] = useState();
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    if (stage === Stage.Complete && !score && xmlFile) {
      NFClient.init(function (info) {
        score = new NFClient.ScoreView('sheetMusic', 'c79be75c793c3b185365c241a04045e7df05d238', {
          width: '90%',
          height: '90%',
          viewParams: {
            displayMode: 'paginated',
            hideFullWindow: true,
          },
        });

        score.addEventListener('any', (e) => {
          console.log(e);
          if (e.type === 'scoreReady' && !loaded) {
            setLoaded(true);
          }
        });
      });
    }
  }, [stage, xmlFile]);

  useEffect(() => {
    if (score && loaded) score.loadMusicXML(readFileSync(xmlFile).toString());
  }, [loaded]);

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
      {/* {stage === Stage.Complete && loaded && ( */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: stage === Stage.Complete && loaded ? 1 : 0 }}>
        <button style={{ margin: 20 }} onClick={() => score.printScore({ usePrinter: false })}>
          Save PDF
          <FileText style={{ marginLeft: 8 }} />
        </button>
        <button
          style={{ margin: 20 }}
          onClick={async () => {
            const file = remote.dialog.showSaveDialogSync({ defaultPath: basename(xmlFile) });
            if (file) writeFileSync(file, readFileSync(xmlFile).toString());
          }}
        >
          Save MusicXML
          <Code style={{ marginLeft: 8 }} />
        </button>
      </div>
      <div id="sheetMusic" />
      <Log />
    </div>
  );
};
