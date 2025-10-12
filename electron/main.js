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
    if (quizWindow && !quizWindow.isDestroyed() && !quizWindow.allowExit) {
      const violation = {
        type: 'window_switch',
        message: 'Attempted to switch to another window (Alt+Tab detected)',
        timestamp: new Date().toLocaleTimeString(),
        severity: 'high'
      };
      quizWindow.webContents.send('quiz-violation-detected', violation);
      quizWindow.focus(); // Force focus back
    }
  });

  // Detect attempt to leave fullscreen
  quizWindow.on('leave-full-screen', () => {
    if (quizWindow && !quizWindow.isDestroyed() && !quizWindow.allowExit) {
      const violation = {
        type: 'fullscreen_exit',
        message: 'Attempted to exit fullscreen mode (F11 or Esc pressed)',
        timestamp: new Date().toLocaleTimeString(),
        severity: 'high'
      };
      quizWindow.webContents.send('quiz-violation-detected', violation);
      quizWindow.setFullScreen(true); // Force back to fullscreen
    }
  });

  // Prevent window from being minimized
  quizWindow.on('minimize', (event) => {
    if (!quizWindow.allowExit) {
      event.preventDefault();
      if (quizWindow && !quizWindow.isDestroyed()) {
        const violation = {
          type: 'window_minimize',
          message: 'Attempted to minimize the quiz window',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'medium'
        };
        quizWindow.webContents.send('quiz-violation-detected', violation);
        quizWindow.restore();
      }
    }
  });

  // Handle window close attempt
  quizWindow.on('close', (event) => {
    // Only allow close if triggered by our own code or after quiz completion
    if (!quizWindow.forceClose && !quizWindow.allowExit) {
      event.preventDefault();
      const violation = {
        type: 'window_close',
        message: 'Attempted to close the quiz window (X button or Alt+F4)',
        timestamp: new Date().toLocaleTimeString(),
        severity: 'high'
      };
      quizWindow.webContents.send('quiz-violation-detected', violation);
    }
  });

  // Monitor for additional keyboard shortcuts
  quizWindow.webContents.on('before-input-event', (event, input) => {
    if (!quizWindow.allowExit) {
      let violation = null;
      
      // Detect Alt+Tab
      if (input.alt && input.key.toLowerCase() === 'tab') {
        violation = {
          type: 'alt_tab',
          message: 'Alt+Tab shortcut detected - attempting to switch windows',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'high'
        };
      }
      // Detect Windows key
      else if (input.key === 'Meta' || input.key === 'Super') {
        violation = {
          type: 'windows_key',
          message: 'Windows key pressed - attempting to open start menu',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'high'
        };
      }
      // Detect F11 (fullscreen toggle)
      else if (input.key === 'F11') {
        violation = {
          type: 'f11_key',
          message: 'F11 key pressed - attempting to toggle fullscreen',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'high'
        };
      }
      // Detect Escape key
      else if (input.key === 'Escape') {
        violation = {
          type: 'escape_key',
          message: 'Escape key pressed - attempting to exit fullscreen',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'high'
        };
      }
      // Detect Alt+F4 (close window)
      else if (input.alt && input.key === 'F4') {
        violation = {
          type: 'alt_f4',
          message: 'Alt+F4 shortcut detected - attempting to close window',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'high'
        };
      }
      // Detect Ctrl+Shift+I (DevTools)
      else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        violation = {
          type: 'devtools_shortcut',
          message: 'Ctrl+Shift+I detected - attempting to open developer tools',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'medium'
        };
      }
      // Detect Ctrl+R (refresh)
      else if (input.control && input.key.toLowerCase() === 'r') {
        violation = {
          type: 'refresh_shortcut',
          message: 'Ctrl+R detected - attempting to refresh page',
          timestamp: new Date().toLocaleTimeString(),
          severity: 'medium'
        };
      }

      if (violation) {
        event.preventDefault(); // Prevent the default action
        quizWindow.webContents.send('quiz-violation-detected', violation);
      }
    }
  });

  // Handle window destruction
  quizWindow.on('closed', () => {
    quizWindow = null;
    // Focus back on main window when quiz window is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
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

// Allow quiz window to exit after completion
ipcMain.on('allow-quiz-exit', () => {
  if (quizWindow && !quizWindow.isDestroyed()) {
    quizWindow.allowExit = true;
    // Remove kiosk mode and fullscreen to allow normal exit
    quizWindow.setKiosk(false);
    quizWindow.setFullScreen(false);
    // Make window closable
    quizWindow.setClosable(true);
    // Remove always on top
    quizWindow.setAlwaysOnTop(false);
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
