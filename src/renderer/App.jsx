import React, { useState } from 'react';

import { isDevelopment } from '../common/constants';
import { sampleData } from '../common/sampleData';
import { Status } from './Status';
import { Webview } from './Webview';

const useSampleData = true;

export const App = () => {
  const [data, setData] = useState(isDevelopment && useSampleData ? sampleData.SoundOfSilence : undefined);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!data && <Webview updateData={(data) => setData(data)} />}
      {data && <Status data={data} setData={(data) => setData(data)} />}
    </div>
  );
};
