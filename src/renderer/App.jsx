import React, { useState } from 'react';
import { Download } from './Download';

import { Webview } from './Webview';

const sampleData = {
  images: [
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/0.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/1.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/2.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/3.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/4.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/5.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/6.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/7.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/8.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/9.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/10.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/11.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/12.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/13.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/14.png',
    'https://flowkeycdn.com/sheets/5SbNyQhdXTR8gGkLJ/300/15.png',
  ],
  id: 'Se9khytc6bnMnGC87',
  title: 'Hallelujah',
  artist: 'Leonard Cohen',
};

export const App = () => {
  const [data, setData] = useState(sampleData);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!data && <Webview updateData={(data) => setData(data)} />}
      {data && <Download data={data} />}
    </div>
  );
};
