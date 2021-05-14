import React, { useState } from 'react';

import { isDevelopment } from '../common/constants';
import { Status } from './Status';
import { Webview } from './Webview';

const sampleData = {
  images: [
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/0.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/1.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/2.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/3.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/4.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/5.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/6.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/7.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/8.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/9.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/10.png',
    'https://flowkeycdn.com/sheets/GzcBWKZdq64xwWPhq/300/11.png',
  ],
  id: 'WWSpLW8Xkete2z8mc',
  title: 'The Sound of Silence',
  artist: 'Simon & Garfunkel',
};

const useSampleData = true;

export const App = () => {
  const [data, setData] = useState(isDevelopment && useSampleData ? sampleData : undefined);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!data && <Webview updateData={(data) => setData(data)} />}
      {data && <Status data={data} setData={(data) => setData(data)} />}
    </div>
  );
};
