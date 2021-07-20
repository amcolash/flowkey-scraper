import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer } from 'electron';
import { ArrowLeft, ArrowRight, Cpu, Home } from 'react-feather';
import { Colors } from '../common/constants';

const DEBUG = false;
const baseUrl = 'https://app.flowkey.com/browse';

export const Webview = (props) => {
  const webview = useRef();
  const [preload, setPreload] = useState();
  const [displayUrl, setDisplayUrl] = useState(baseUrl);

  useEffect(() => {
    // Ask for preload path from main, then set state and inform webview about it
    ipcRenderer.send('preload-main');
    ipcRenderer.on('preload-render', (event, arg) => setPreload(arg));

    if (!webview.current) return;

    webview.current.addEventListener('did-navigate-in-page', (e) => {
      if (e.url.indexOf('/player') !== -1) webview.current.executeJavaScript('window.addButton();');

      setDisplayUrl(e.url);
    });

    webview.current.addEventListener('dom-ready', () => {
      if (DEBUG) webview.current.openDevTools();
    });

    webview.current.addEventListener('ipc-message', (event) => {
      if (event.channel === 'data') {
        console.log(event.args[0]);
        props.updateData(event.args[0]);
      }
    });
  });

  // Only show webview once we know the path to the preload script */
  return preload ? (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 3 }}>
        <button
          style={{ padding: 3, margin: 3 }}
          onClick={() => webview.current.goBack()}
          disabled={!webview.current || !webview.current.canGoBack()}
        >
          <ArrowLeft height="20" width="20" />
        </button>
        <button style={{ padding: 3, margin: 3 }} onClick={() => webview.current.loadURL(baseUrl)} disabled={displayUrl === baseUrl}>
          <Home height="20" width="20" />
        </button>
        <button
          style={{ padding: 3, margin: 3, marginRight: 6 }}
          onClick={() => webview.current.goForward()}
          disabled={!webview.current || !webview.current.canGoForward()}
        >
          <ArrowRight height="20" width="20" />
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: 3,
            margin: 3,
            border: `1px solid ${Colors.Charcoal}`,
            fontSize: 14,
            userSelect: 'none',
          }}
        >
          {displayUrl}
        </div>
        <button style={{ padding: 3, margin: 3 }} onClick={() => webview.current.openDevTools()}>
          <Cpu height="20" width="20" />
        </button>
      </div>
      <webview src={baseUrl} style={{ width: '100%', height: '100%' }} ref={webview} preload={'file:///' + preload} />
    </div>
  ) : null;
};
