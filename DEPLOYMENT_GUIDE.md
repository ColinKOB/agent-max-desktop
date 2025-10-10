# 🚀 Deployment Guide - Agent Max Desktop

## Overview

This app now supports **both local development and production deployment** with a remote backend!

---

## 📋 **Architecture**

### Development Mode:
```
Desktop App (localhost:5173)
    ↓
Local Backend (localhost:8000)
```

### Production Mode:
```
Desktop App (User's Computer)
    ↓ HTTPS
Remote Backend (your-api.com)
    ↓
OpenAI API
```

---

## 🔧 **Configuration**

### **Option 1: Environment Variable (Recommended)**

Create a `.env` file in the root directory:

```bash
# .env
VITE_API_URL=https://your-backend-server.com
```

### **Option 2: Update Config File**

Edit `src/config/api.js`:

```javascript
const DEFAULT_PRODUCTION_API = 'https://api.agentmax.com'; // ← Change this!
```

---

## 🏗️ **Backend Deployment**

### **Step 1: Deploy FastAPI Backend**

Choose a hosting platform:
- **Railway.app** (Easiest)
- **Render.com** (Free tier available)
- **DigitalOcean App Platform**
- **AWS/GCP/Azure**

### **Step 2: Update CORS Settings**

In your backend's `api/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **Step 3: Get Your Backend URL**

After deployment, you'll get a URL like:
- `https://agent-max-production.up.railway.app`
- `https://agent-max-api.onrender.com`

---

## 💻 **Desktop App Build**

### **For Development:**

```bash
# Uses localhost:8000
npm run electron:dev
```

### **For Production Build:**

```bash
# Option 1: Set environment variable
VITE_API_URL=https://your-api.com npm run build
npm run electron:build

# Option 2: Update config file first, then build
npm run build
npm run electron:build
```

---

## 📦 **Building for Distribution**

### **macOS:**

```bash
# Install electron-builder
npm install -D electron-builder

# Build for macOS
npm run electron:build

# Output: dist/Agent Max-1.0.0.dmg
```

### **Windows:**

```bash
# Build for Windows
npm run electron:build -- --win

# Output: dist/Agent Max Setup 1.0.0.exe
```

### **Linux:**

```bash
# Build for Linux
npm run electron:build -- --linux

# Output: dist/agent-max-1.0.0.AppImage
```

---

## 🧪 **Testing Production Build**

### **1. Test with Remote Backend:**

```bash
# Create .env file
echo "VITE_API_URL=https://your-backend.com" > .env

# Test in dev mode first
npm run electron:dev

# Check DevTools console:
# [API] Initializing with Base URL: https://your-backend.com
```

### **2. Verify Connection:**

Open DevTools (Cmd+Option+I) and look for:

```
✅ [API] Initializing with Base URL: https://your-backend.com
✅ [Health] Fetch test successful
✅ [Health] Axios request successful
```

---

## 🔐 **Security Considerations**

### **API Key:**

If your backend requires an API key:

```bash
# .env
VITE_API_URL=https://your-api.com
VITE_API_KEY=your-secret-key
```

Then in code:
```javascript
// API requests automatically include key from localStorage
// Set it once: localStorage.setItem('api_key', 'your-key');
```

### **HTTPS Required:**

- ✅ Use HTTPS for production backend
- ✅ Get free SSL from Let's Encrypt
- ❌ Don't use HTTP in production

---

## 📊 **URL Priority**

The app checks for API URL in this order:

1. **Environment Variable** (`VITE_API_URL` in `.env`)
2. **Development Mode** (`http://localhost:8000`)
3. **Production Default** (from `src/config/api.js`)

---

## 🎯 **Example Deployment Workflow**

### **Using Railway.app (Recommended):**

```bash
# 1. Push backend to GitHub
cd Agent_Max
git init
git add .
git commit -m "Initial commit"
git push origin main

# 2. Deploy on Railway
# - Go to railway.app
# - Connect GitHub repo
# - Deploy
# - Get URL: https://agent-max-xyz.up.railway.app

# 3. Update desktop app
cd ../agent-max-desktop
echo "VITE_API_URL=https://agent-max-xyz.up.railway.app" > .env

# 4. Build desktop app
npm run build
npm run electron:build

# 5. Distribute: dist/Agent Max-1.0.0.dmg
```

---

## ✅ **Checklist for Production**

- [ ] Backend deployed and accessible via HTTPS
- [ ] CORS configured to allow all origins
- [ ] API URL set in `.env` or `config/api.js`
- [ ] App tested with remote backend
- [ ] Build created for your platform
- [ ] App tested on a fresh machine

---

## 🐛 **Troubleshooting**

### **"Cannot reach the server"**

**Check:**
1. Backend is running: `curl https://your-api.com/health`
2. CORS is enabled on backend
3. API URL is correct in console logs
4. No firewall blocking the app

### **CORS Errors**

**Fix:** Add to backend's `main.py`:
```python
allow_origins=["*"]  # Allows Electron app
```

### **SSL Certificate Errors**

**Fix:** Ensure backend uses valid HTTPS certificate

---

## 📱 **For End Users**

Users downloading your app will:
1. Download the `.dmg` / `.exe` file
2. Install Agent Max
3. Open the app
4. **Automatically connect to your remote backend!**

No configuration needed! ✅

---

## 🎉 **You're Ready!**

Your app is now configured for:
- ✅ Local development (localhost)
- ✅ Production deployment (remote server)
- ✅ Distribution to end users
- ✅ Cross-platform support

**Next steps:**
1. Deploy your backend
2. Update `VITE_API_URL`
3. Build the app
4. Test on a fresh machine
5. Distribute! 🚀
