import React, { useEffect, useState } from 'react';
import { Terminal } from 'react-feather';
import { style } from 'typestyle';

import { Colors } from '../common/constants';

let logValues = [];

export const log = (item) => {
  logValues.push({ time: new Date(), random: Math.random(), value: item.value || item });
  console.log(item.value || item);
};

export const error = (item) => {
  logValues.push({ time: new Date(), random: Math.random(), value: item, error: true });
  console.error(item);
};

export const getLog = () => logValues;

export const clearLog = () => {
  logValues = [];
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
          top: -50,
          right: 10,
          color: Colors.LightGrey,
          background: Colors.Charcoal,
        }}
      >
        <Terminal />
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
          <div key={l.time + l.value + l.random} className={l.error ? errorText : undefined}>
            {l.value}
          </div>
        ))}
      </div>
    </div>
  );
};
