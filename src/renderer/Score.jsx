import { readFileSync } from 'fs';
import React, { useEffect, useState } from 'react';
import { Code, FileText } from 'react-feather';
import { isDevelopment } from '../common/constants';

import NFClient from '../common/nfclient';

export const Score = (props) => {
  if (!props.xmlFile) return null;

  const [score, setScore] = useState();
  const [loaded, setLoaded] = useState(false);
  const [bpm, setBpm] = useState(120);

  useEffect(() => {
    if (!score && props.xmlFile) {
      NFClient.init(function (info) {
        const score = new NFClient.ScoreView('sheetMusic', 'c79be75c793c3b185365c241a04045e7df05d238', {
          width: '90%',
          height: '80%',
          viewParams: {
            displayMode: 'paginated',
            hideFullWindow: true,
          },
        });

        score.addEventListener('any', (e) => {
          if (isDevelopment) console.log(e);
          if (e.type === 'scoreReady' && !loaded) {
            setLoaded(true);
          }
        });

        setScore(score);
      });
    }
  }, [props.xmlFile]);

  useEffect(() => {
    if (score && loaded) score.loadMusicXML(readFileSync(props.xmlFile).toString());
  }, [score, loaded]);

  useEffect(() => {
    if (score && loaded) score.setPlaybackTempo(bpm);
  }, [bpm]);

  const margin = 10;

  return (
    <div style={{ marginTop: 50, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button style={{ margin }} onClick={() => score.printScore({ usePrinter: false })}>
          Save PDF
          <FileText style={{ marginLeft: 8 }} />
        </button>
        <button
          style={{ margin }}
          onClick={async () => {
            const file = remote.dialog.showSaveDialogSync({ defaultPath: basename(xmlFile) });
            if (file) writeFileSync(file, readFileSync(xmlFile).toString());
          }}
        >
          Save MusicXML
          <Code style={{ marginLeft: 8 }} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14, margin }}>
          <label>BPM</label>
          <input type="number" onChange={(e) => setBpm(e.target.value)} min={0} max={200} value={bpm} />
        </div>
      </div>
      <div id="sheetMusic" />
    </div>
  );
};
