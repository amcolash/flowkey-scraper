import React from 'react';
import { render } from 'react-dom';
import { cssRule } from 'typestyle';
import { Colors } from '../common/constants';

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
  cursor: 'pointer',

  $nest: {
    '&:hover': {
      borderColor: Colors.Green,
      color: Colors.Green,
    },
  },
});

render(<App />, document.getElementById('app'));
