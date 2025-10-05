// Electron IPC Helper for React
// This file provides a safe interface to interact with Electron IPC

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    require?: (module: string) => any;
  }
}

// Check if running in Electron
export const isElectron = (): boolean => {
  return !!(window && window.require);
};

// Get IPC Renderer
const getIpcRenderer = () => {
  if (isElectron()) {
    try {
      const { ipcRenderer } = window.require!('electron');
      return ipcRenderer;
    } catch (error) {
      console.error('Failed to get ipcRenderer:', error);
      return null;
    }
  }
  return null;
};

// Open quiz in lockdown mode
export const openQuizWindow = (quizId: number): void => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.send('open-quiz-window', quizId);
  } else {
    console.warn('Not running in Electron, quiz lockdown mode unavailable');
  }
};

// Close quiz window
export const closeQuizWindow = (): void => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.send('close-quiz-window');
  }
};

// Force submit quiz (called after max warnings)
export const forceSubmitQuiz = (): void => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.send('force-submit-quiz');
  }
};

// Listen for quiz window events
export const onQuizWindowBlur = (callback: () => void): (() => void) => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.on('quiz-window-blur', callback);
    return () => ipcRenderer.removeListener('quiz-window-blur', callback);
  }
  return () => {};
};

export const onQuizLeaveFullscreen = (callback: () => void): (() => void) => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.on('quiz-leave-fullscreen', callback);
    return () => ipcRenderer.removeListener('quiz-leave-fullscreen', callback);
  }
  return () => {};
};

export const onQuizMinimizeAttempt = (callback: () => void): (() => void) => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.on('quiz-minimize-attempt', callback);
    return () => ipcRenderer.removeListener('quiz-minimize-attempt', callback);
  }
  return () => {};
};

export const onQuizCloseAttempt = (callback: () => void): (() => void) => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.on('quiz-close-attempt', callback);
    return () => ipcRenderer.removeListener('quiz-close-attempt', callback);
  }
  return () => {};
};

export const onAutoSubmitQuiz = (callback: () => void): (() => void) => {
  const ipcRenderer = getIpcRenderer();
  if (ipcRenderer) {
    ipcRenderer.on('auto-submit-quiz', callback);
    return () => ipcRenderer.removeListener('auto-submit-quiz', callback);
  }
  return () => {};
};
