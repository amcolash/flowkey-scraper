import { remote } from 'electron';
import { copyFileSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import React, { useEffect, useState } from 'react';
import { Code, FileText, Image } from 'react-feather';
import { cssRule } from 'typestyle';

import { isDevelopment, tmpPath } from '../common/constants';
import NFClient from '../common/nfclient';
import { port } from '../common/shared_constants';
import { imageDir } from '../common/stages/images';
import { getTitle } from '../common/util';

cssRule('#sheetMusic', {
  border: '1px solid #aaa !important',
});

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
            scale: window.innerWidth > 1450 ? 2 : 1.5,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <button style={{ margin }} onClick={() => score.printScore({ usePrinter: false })}>
          Save PDF
          <FileText style={{ marginLeft: 8 }} />
        </button>
        <button
          style={{ margin }}
          onClick={() => {
            const file = remote.dialog.showSaveDialogSync({ defaultPath: basename(xmlFile) });
            if (file) writeFileSync(file, readFileSync(xmlFile).toString());
          }}
        >
          Save MusicXML
          <Code style={{ marginLeft: 8 }} />
        </button>
        <button
          style={{
            margin,
          }}
          onClick={() => {
            const url = `http://localhost:${port}/${relative(tmpPath, props.xmlFile)}`;
            remote.shell.openExternal(`https://www.noteflight.com/scores/create?scoreTemplateURL=${url}`);
          }}
        >
          Open in Noteflight
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 67.733 67.733" style={{ marginLeft: 8 }}>
            <path d="M4.154 19.6v42.388L63.58 48.132V5.745z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            <ellipse ry="12.202" rx="20.372" cy="33.867" cx="33.867" fill="none" stroke="currentColor" strokeWidth="4" />
            <ellipse
              transform="matrix(.94342 -.3316 .31277 .94983 0 0)"
              ry="6.474"
              rx="4.609"
              cy="43.189"
              cx="21.579"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
            />
          </svg>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14, margin: `${margin}px 20px` }}>
          <label style={{ marginBottom: 6, textAlign: 'center' }}>BPM</label>
          <input
            type="number"
            onChange={(e) => setBpm(e.target.value)}
            min={0}
            max={200}
            value={bpm}
            style={{ width: 45, textAlign: 'right' }}
          />
        </div>

        <button
          style={{ margin }}
          onClick={() => {
            const title = getTitle(props.data);
            const finalFile = join(imageDir, `${title}.png`);

            const file = remote.dialog.showSaveDialogSync({ defaultPath: `${title}.png` });
            if (file) copyFileSync(finalFile, file);
          }}
        >
          Save Intermediate Image
          <Image style={{ marginLeft: 8 }} />
        </button>
      </div>
      <div id="sheetMusic" />
    </div>
  );
};
