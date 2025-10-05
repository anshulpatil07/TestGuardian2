# Quick Start Guide - Quiz Lockdown Mode

## 🚀 Quick Setup (First Time)

### 1. Install All Dependencies
```powershell
# Root dependencies (Electron, concurrently, etc.)
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Setup Database
```powershell
cd backend

# Run migrations
npx prisma migrate dev

# Seed database (creates test accounts)
npx prisma db seed

cd ..
```

### 3. Start Everything
```powershell
# Start backend, frontend, and Electron together
npm run dev
```

This will:
- Start backend server on http://localhost:5000
- Start frontend dev server on http://localhost:5173
- Wait for frontend to be ready
- Launch Electron app automatically
