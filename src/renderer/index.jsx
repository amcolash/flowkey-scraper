import React from 'react';
import { render } from 'react-dom';
import { cssRule } from 'typestyle';

import { App } from './App.jsx';

cssRule('body', {
  margin: 0,
  background: '#eee',
  color: '#222',
  fontSize: 24,
  fontFamily: 'sans-serif',
});

render(<App />, document.getElementById('app'));
