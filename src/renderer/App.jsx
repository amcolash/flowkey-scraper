import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer } from 'electron';

export const App = () => {
  const webview = useRef();
  const [preload, setPreload] = useState();

  useEffect(() => {
    // Ask for preload path from main, then set state and inform webview about it
    ipcRenderer.send('preload-main');
    ipcRenderer.on('preload-render', (event, arg) => setPreload(arg));

    if (!webview.current) return;

    webview.current.addEventListener('did-navigate-in-page', (e) => {
      if (e.url.indexOf('/player') !== -1) webview.current.executeJavaScript('window.addButton();');
    });

    if (process.env.NODE_ENV !== 'production') {
      webview.current.addEventListener('dom-ready', () => {
        webview.current.openDevTools();
      });
    }

    webview.current.addEventListener('ipc-message', (event) => {
      if (event.channel === 'data') {
        console.log(event.args[0]);
      }
    });
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Only show webview once we know the path to the preload script */}
      {preload && (
        <webview src="https://app.flowkey.com/" style={{ width: '100%', height: '100%' }} ref={webview} preload={'file:///' + preload} />
      )}
    </div>
  );
};
