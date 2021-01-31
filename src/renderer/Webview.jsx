import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer } from 'electron';

const DEBUG = false;

export const Webview = (props) => {
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
    <webview src="https://app.flowkey.com/" style={{ width: '100%', height: '100%' }} ref={webview} preload={'file:///' + preload} />
  ) : null;
};
