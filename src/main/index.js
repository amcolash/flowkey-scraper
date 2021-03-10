'use strict';

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { readFile } from 'fs';
import { createServer } from 'http';
import { join, resolve } from 'path';
import { format as formatUrl } from 'url';

import { port } from '../common/shared_constants';

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow;

function createMainWindow() {
  const window = new BrowserWindow({
    webPreferences: { nodeIntegration: true, webviewTag: true, webSecurity: false },
    ...(isDevelopment ? { width: 800, height: 1000 } : { width: 1200, height: 900 }),
    title: isDevelopment ? undefined : `${app.getName()} (${app.getVersion()})`,
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

  // check for updates and update as needed - such a slick setup w/ github releases
  autoUpdater.checkForUpdatesAndNotify();

  const tmpPath = join(app.getPath('userData'), 'tmp');

  createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Parse file path. For some reason, the %20 is being converted to a space, so fix that
    const filePath = join(tmpPath, decodeURIComponent(req.url).replace(/\+/g, ' '));
    readFile(filePath, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end('Could not find file for the url', req.url);
        return;
      }

      res.writeHead(200);
      res.end(data);
    });
  }).listen(port, () => console.log(`Running at http://localhost:${port}, serving ${tmpPath}`));
});
