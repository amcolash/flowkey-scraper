'use strict';

import { app, BrowserWindow, ipcMain } from 'electron';
import { join, resolve } from 'path';
import { format as formatUrl } from 'url';
import { port } from '../common/shared_constants';

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow;

function createMainWindow() {
  const window = new BrowserWindow({
    webPreferences: { nodeIntegration: true, webviewTag: true, webSecurity: false },
    ...(isDevelopment ? { width: 800, height: 800, x: 1920 - 850, y: 150 } : { width: 1200, height: 900 }),
  });

  window.setMenuBarVisibility(false);

  if (isDevelopment) {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => {
        console.log(`Added Extension:  ${name}`);
        window.webContents.openDevTools();
      })
      .catch((err) => console.log('An error occurred: ', err));
  }

  if (isDevelopment) {
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
  } else {
    window.loadURL(
      formatUrl({
        pathname: join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true,
      })
    );
  }

  ipcMain.on('preload-main', (e) => {
    const preloadPath = resolve(join(__dirname, 'preload.js'));
    e.reply('preload-render', preloadPath);
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  window.webContents.on('devtools-opened', () => {
    window.focus();
    setImmediate(() => {
      window.focus();
    });
  });

  return window;
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow();

  const tmpPath = join(app.getPath('userData'), 'tmp');
  const nodeStatic = require('node-static');
  const file = new nodeStatic.Server(tmpPath, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

  require('http')
    .createServer(function (request, response) {
      request
        .addListener('end', function () {
          file.serve(request, response);
        })
        .resume();
    })
    .listen(port);
});
