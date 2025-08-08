const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// Sostituisci questa riga
// const isDev = require('electron-is-dev');

// Con questa implementazione che non richiede dipendenze esterne
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.DEBUG_PROD === 'true' || 
              !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'StageCue',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:9002');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});