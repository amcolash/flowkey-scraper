import React from 'react';
import { render } from 'react-dom';
import { cssRule } from 'typestyle';
import { Colors } from '../common/constants';
import { initTemplates } from '../common/opencv';

import { App } from './App.jsx';

cssRule('body', {
  margin: 0,
  background: '#eee',
  color: '#222',
  fontSize: 24,
  fontFamily: 'sans-serif',
  overflow: 'hidden',
});

cssRule('button', {
  display: 'flex',
  alignItems: 'center',
  borderRadius: 6,
  padding: 6,
  border: `2px solid ${Colors.Grey}`,
  background: 'rgba(0,0,0,0)',
  transition: 'all 0.5s',

  $nest: {
    '&:not([disabled]):hover': {
      borderColor: Colors.Green,
      color: Colors.Green,
      cursor: 'pointer',
    },
    '&:disabled': {
      filter: 'brightness(1.5)',
    },
  },
});

async function init() {
  // Load templates for matching, only load once on initial app load
  await initTemplates();

  // After we have loaded templates, then start things up
  render(<App />, document.getElementById('app'));
}

init();
