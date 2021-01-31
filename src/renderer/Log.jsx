import React, { useEffect, useState } from 'react';
import { Terminal } from 'react-feather';
import { style } from 'typestyle';

import { Colors } from '../common/constants';

let logValues = [];

export const log = (item) => {
  logValues = [...logValues, item];
  console.log(item.value || item);
};

export const error = (item) => {
  logValues = [...logValues, { value: item, error: true }];
  console.error(item);
};

const errorText = style({
  color: 'red',
});

export const Log = () => {
  const [expanded, setExpanded] = useState(false);
  const [logState, setLogState] = useState([]);

  useEffect(() => {
    setLogState(logValues);
  }, [logValues]);

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
      <div
        style={{
          overflowY: 'auto',
          padding: 10,
          height: 'calc(100% - 20px)',
          overflowWrap: 'break-word',
          display: 'flex',
          flexDirection: 'column-reverse',
        }}
      >
        {[...logState].reverse().map((l) => (
          <div key={l.key || l.value || l} className={l.error ? errorText : undefined}>
            {l.value || l}
          </div>
        ))}
      </div>
    </div>
  );
};
