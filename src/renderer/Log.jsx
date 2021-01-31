import React, { useEffect, useState } from 'react';
import { Terminal } from 'react-feather';
import { style } from 'typestyle';

import { Colors } from '../constants';

export const appendLog = (item) => updateLog(item);
let updateLog;

const errorText = style({
  color: 'red',
});

export const Log = () => {
  const [log, setLog] = useState([]);
  const [expanded, setExpanded] = useState(false);

  // Not safe if multiple are mounted
  updateLog = (item) => setLog([...log, item]);

  return (
    <div
      style={{
        background: Colors.Charcoal,
        color: Colors.LightGrey,
        fontSize: 14,
        fontFamily: 'monospace',

        maxHeight: '50%',
        height: '100%',
        width: '100%',

        transform: expanded ? 'translateY(-100%)' : undefined,
        transition: 'transform 0.5s',
        position: 'absolute',
        top: '100%',
        left: 0,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'absolute',
          top: -44,
          right: 10,
          color: Colors.LightGrey,
          background: Colors.Charcoal,
        }}
      >
        <Terminal width={16} height={16} />
      </button>
      <div style={{ overflowY: 'auto', padding: 10, height: 'calc(100% - 20px)', overflowWrap: 'break-word' }}>
        {log.map((l) => (
          <div key={l.key || l.value || l} className={l.error ? errorText : undefined}>
            {l.value || l}
          </div>
        ))}
      </div>
    </div>
  );
};
