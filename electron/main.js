const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let quizWindow;
let backendProcess;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const startURL =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173' // Vite dev server
      : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

  mainWindow.loadURL(startURL);
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// Create fullscreen quiz window with lockdown
const createQuizWindow = (quizId) => {
  // Close existing quiz window if any
  if (quizWindow) {
    quizWindow.destroy();
  }

  quizWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true, // Prevents Esc/Alt+Tab exit
    frame: false, // Remove window frame
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false, // Prevent closing with X
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // Hide menu bar
  quizWindow.setMenuBarVisibility(false);

  const quizURL =
    process.env.NODE_ENV === 'development'
      ? `http://localhost:5173/quiz-attempt/${quizId}?lockdown=true`
      : `file://${path.join(__dirname, '../frontend/dist/index.html')}#/quiz-attempt/${quizId}?lockdown=true`;

  quizWindow.loadURL(quizURL);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    quizWindow.webContents.openDevTools();
  }

  // Detect window blur (user trying to switch away)
  quizWindow.on('blur', () => {
    if (quizWindow && !quizWindow.isDestroyed()) {
      quizWindow.webContents.send('quiz-window-blur');
      quizWindow.focus(); // Force focus back
    }
  });

  // Detect attempt to leave fullscreen
  quizWindow.on('leave-full-screen', () => {
    if (quizWindow && !quizWindow.isDestroyed()) {
      quizWindow.webContents.send('quiz-leave-fullscreen');
      quizWindow.setFullScreen(true); // Force back to fullscreen
    }
  });

  // Prevent window from being minimized
  quizWindow.on('minimize', (event) => {
    event.preventDefault();
    if (quizWindow && !quizWindow.isDestroyed()) {
      quizWindow.webContents.send('quiz-minimize-attempt');
      quizWindow.restore();
    }
  });

  // Handle window close attempt
  quizWindow.on('close', (event) => {
    // Only allow close if triggered by our own code
    if (!quizWindow.forceClose) {
      event.preventDefault();
      quizWindow.webContents.send('quiz-close-attempt');
    }
  });

  return quizWindow;
};

// IPC Handlers
ipcMain.on('open-quiz-window', (event, quizId) => {
  createQuizWindow(quizId);
});

ipcMain.on('close-quiz-window', () => {
  if (quizWindow && !quizWindow.isDestroyed()) {
    quizWindow.forceClose = true;
    quizWindow.close();
    quizWindow = null;
    
    // Focus back on main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  }
});

ipcMain.on('force-submit-quiz', () => {
  if (quizWindow && !quizWindow.isDestroyed()) {
    quizWindow.webContents.send('auto-submit-quiz');
  }
});

app.on('ready', () => {
  // Start Express backend
  backendProcess = spawn('node', ['server.js'], { cwd: path.join(__dirname, '../backend') });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (backendProcess) backendProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
