# Quiz Lockdown Mode - Feature Guide

## Overview
The Quiz Lockdown Mode is an Electron-based security feature that prevents students from cheating during quiz attempts by:
- Opening quizzes in a fullscreen, kiosk-mode window
- Monitoring and preventing window switching, minimizing, or closing
- Tracking violations with a warning system (3 strikes)
- Auto-submitting the quiz after 3 warnings
- Preventing exit from fullscreen mode

## Architecture

### Components
1. **Electron Main Process** (`electron/main.js`)
   - Creates locked-down quiz windows with fullscreen/kiosk mode
   - Monitors window events (blur, minimize, close attempts)
   - Forces focus back to quiz window on violations
   - IPC handlers for quiz window management

2. **IPC Communication Layer** (`frontend/src/utils/electronIPC.ts`)
   - Safe bridge between React and Electron
   - Detects if running in Electron environment
   - Event listeners for lockdown violations
   - Window control functions

3. **Student Dashboard** (`frontend/src/pages/StudentDashboard.tsx`)
   - Detects Electron environment
   - Launches quiz in lockdown window vs normal browser navigation
   - Entry point for lockdown mode

4. **Quiz Attempt Page** (`frontend/src/pages/QuizAttempt.tsx`)
   - Detects lockdown mode from URL parameter (`?lockdown=true`)
   - Implements warning system with counter
   - Listens to browser events (blur, visibilitychange)
   - Listens to Electron IPC events (window violations)
   - Displays warning popup with countdown
   - Auto-submits quiz after 3 warnings
   - Closes window on successful submission

## How It Works

### Normal Browser Mode (Without Electron)
1. Student clicks "Attempt Quiz" → Opens in browser tab
2. No lockdown restrictions applied
3. Regular quiz-taking experience

### Lockdown Mode (With Electron)
1. Student clicks "Attempt Quiz" → Electron opens fullscreen window
2. URL includes `?lockdown=true` parameter
3. Window configured as:
   - Fullscreen: true
   - Kiosk: true
   - Closable: false
   - AlwaysOnTop: true
   - No menu bar

4. **Violation Detection:**
   - Browser events: `window.blur`, `document.visibilitychange`
   - Electron events: `window.blur`, `leave-full-screen`, `minimize`, `close`

5. **Warning System:**
   - First violation → Warning 1/3 popup (4 seconds)
   - Second violation → Warning 2/3 popup (4 seconds)
   - Third violation → Final warning + auto-submit (2 seconds)

6. **Completion:**
   - On submit → Show score → Close Electron window
   - On auto-submit → Force submit → Close window

## Setup Instructions

### Prerequisites
- Node.js installed
- PostgreSQL database (Neon or local)
- Backend running on port 5000
- Frontend development server on port 5173

### 1. Backend Setup
```powershell
cd c:\Guardian\backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed database (creates test users)
npx prisma db seed

# Start backend server
npm run dev
```

**Note:** Make sure the backend is configured to run on port 5000 by setting `PORT=5000` in your environment or updating `server.js`:
```javascript
const PORT = process.env.PORT || 5000; // Change 3000 to 5000
```

### 2. Frontend Setup
```powershell
cd c:\Guardian\frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Electron Setup
```powershell
cd c:\Guardian

# Install Electron dependencies (if not already installed)
npm install electron --save-dev

# Run Electron in development mode
npm run electron-dev
```

**Note:** You may need to add this script to `package.json`:
```json
{
  "scripts": {
    "electron-dev": "set NODE_ENV=development && electron electron/main.js"
  }
}
```

## Testing the Lockdown Feature

### Test Accounts
- **Instructor:** instructor@example.com / password123
- **Student:** student@example.com / password123

### Testing Steps

#### 1. Create a Test Quiz (as Instructor)
1. Run Electron app or open browser: http://localhost:5173
2. Sign in with instructor account
3. Click "Create New Quiz"
4. Fill in quiz details:
   - Title: "Lockdown Test Quiz"
   - Description: "Testing lockdown mode"
   - Duration: 10 minutes
   - Password: "test123" (optional)
5. Add at least 2-3 questions with options
6. Mark correct answers
7. Save quiz

#### 2. Test Browser Mode (Without Electron)
1. Open browser: http://localhost:5173
2. Sign in with student account
3. Click "Attempt Quiz" on a quiz
4. Should open in normal browser tab
5. Can switch tabs/windows without warnings

#### 3. Test Lockdown Mode (With Electron)
1. **Run Electron App:**
   ```powershell
   cd c:\Guardian
   npm run electron-dev
   ```

2. **Sign in as Student** (student@example.com / password123)

3. **Attempt Quiz:**
   - Click "Attempt Quiz" on any quiz
   - If password protected, enter password
   - Electron should open a NEW fullscreen window

4. **Test Violation Detection:**
   - **Alt+Tab**: Try switching to another window
     - Should see: "Warning 1/3: Switching away from the quiz window is not allowed"
     - Window focus forced back to quiz
   
   - **Click outside window**: Try clicking desktop/taskbar
     - Should see: "Warning 2/3: Switching away from the quiz window is not allowed"
   
   - **F11 or Esc**: Try exiting fullscreen
     - Should see: "Warning 3/3: Exiting fullscreen mode is not allowed"
     - Should trigger final warning

5. **Test Auto-Submit:**
   - Trigger 3 violations quickly
   - Should see: "Final warning! Auto-submitting quiz..."
   - After 2 seconds, quiz auto-submits
   - Window shows score and closes

6. **Test Normal Submit:**
   - Start a new quiz attempt
   - Answer questions normally
   - Click "Submit Quiz"
   - Should see score and window closes

## Warning System Details

### Warning Display
- **Warning 1-2:** Yellow background, warning icon, 4-second display
- **Warning 3:** Red background, spinning loader, 2-second display + auto-submit

### Warning Messages
- Window blur: "Switching away from the quiz window is not allowed"
- Visibility change: "Switching tabs or minimizing browser is not allowed"
- Leave fullscreen: "Exiting fullscreen mode is not allowed"
- Minimize attempt: "Minimizing the quiz window is not allowed"
- Close attempt: "Closing the quiz window is not allowed"

## Troubleshooting

### Common Issues

#### 1. Electron Window Not Opening
- **Check:** Is Electron installed?
  ```powershell
  npm list electron
  ```
- **Fix:** Install Electron
  ```powershell
  npm install electron --save-dev
  ```

#### 2. Backend Connection Failed
- **Check:** Is backend running on port 5000?
- **Fix:** Update `backend/server.js`:
  ```javascript
  const PORT = 5000; // Hardcode to 5000
  ```

#### 3. Warnings Not Triggering
- **Check:** Is lockdown=true in URL?
- **Check:** Browser console for errors
- **Fix:** Ensure `electronIPC.ts` functions are properly imported

#### 4. Window Won't Close After Submit
- **Check:** Is `closeQuizWindow()` called?
- **Check:** Electron IPC handler registered in main.js
- **Fix:** Verify IPC channel names match

#### 5. DevTools Opening in Lockdown
- **Check:** Is `NODE_ENV=development`?
- **Fix:** Remove DevTools in production:
  ```javascript
  if (process.env.NODE_ENV === 'development') {
    quizWindow.webContents.openDevTools();
  }
  ```

## Security Features

### What's Protected
✅ Window switching (Alt+Tab)
✅ Minimizing window
✅ Closing window
✅ Exiting fullscreen
✅ Browser tab switching
✅ Browser minimize
✅ Multiple attempts at same quiz

### What's NOT Protected
⚠️ Task Manager (can kill process)
⚠️ Power button / system shutdown
⚠️ Virtual machines / screen sharing
⚠️ External devices / second monitors
⚠️ Physical camera/phone cheating

### Recommendations for Enhanced Security
1. **Webcam Monitoring**: Integrate with webcam to detect multiple faces
2. **Screen Recording**: Record screen during quiz attempt
3. **Browser Fingerprinting**: Detect VM or remote desktop
4. **Network Monitoring**: Detect unauthorized network requests
5. **Process Monitoring**: Detect screen capture software

## Development Notes

### File Structure
```
c:\Guardian/
├── electron/
│   └── main.js              # Electron main process
├── frontend/
│   └── src/
│       ├── utils/
│       │   └── electronIPC.ts    # IPC communication layer
│       └── pages/
│           ├── StudentDashboard.tsx    # Entry point
│           └── QuizAttempt.tsx         # Lockdown logic
└── backend/
    └── routes/
        └── quizRoutes.js     # Quiz APIs
```

### Key Code Sections

#### Lockdown Detection
```typescript
const [searchParams] = useSearchParams();
const isLockdownMode = searchParams.get('lockdown') === 'true';
```

#### Warning Handler
```typescript
const handleWarningTrigger = useCallback((reason: string) => {
  setWarningCount((prevCount) => {
    const newCount = prevCount + 1;
    if (newCount >= MAX_WARNINGS) {
      // Auto-submit logic
    } else {
      // Show warning
    }
  });
}, [dependencies]);
```

#### Electron Detection
```typescript
export const isElectron = (): boolean => {
  return !!(window && window.require && window.process?.type === 'renderer');
};
```

## Future Enhancements

### Planned Features
- [ ] IP address tracking per attempt
- [ ] Screenshot detection prevention
- [ ] Clipboard access restriction
- [ ] Copy/paste blocking
- [ ] Right-click menu disabling
- [ ] Browser extension detection
- [ ] Multiple monitor detection
- [ ] AI-powered cheating detection

### Nice to Have
- [ ] Instructor live monitoring dashboard
- [ ] Proctoring mode with webcam
- [ ] Eye-tracking integration
- [ ] Audio monitoring
- [ ] Biometric authentication

## Support

For issues or questions:
1. Check browser console for errors
2. Check Electron DevTools (if in dev mode)
3. Review backend logs
4. Verify database connection

## License
Part of the Guardian Quiz Management System
