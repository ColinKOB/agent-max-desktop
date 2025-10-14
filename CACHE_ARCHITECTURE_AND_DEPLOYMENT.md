# Cache Architecture & Deployment Guide

## 📊 Cache Architecture Overview

Agent Max has **TWO separate caching systems** that work together:

### 1. Frontend Cache (agent-max-desktop)
**Location:** `src/services/responseCache.js`
**Storage:** Browser localStorage
**Scope:** Per-user, per-device

### 2. Backend Cache (Agent_Max)
**Location:** `core/semantic_cache.py`
**Storage:** Disk (JSON files in `state/`)
**Scope:** Shared across all users

---

## 🔄 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                         USER REQUEST                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND CACHE (localStorage)                   │
│  • Checks if question asked 3+ times                        │
│  • Checks if multi-step (never cache)                       │
│  • Exact match → Instant response ⚡                        │
│  • No match → Continue to backend                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Agent_Max)                         │
│  • Receives request from frontend                           │
│  • Checks semantic cache (similar questions)                │
│  • 92%+ similarity → Return cached response                 │
│  • No match → Execute with LLM                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RESPONSE FLOW                                   │
│  • Backend sends response to frontend                       │
│  • Frontend tracks frequency (1/3, 2/3, 3/3)               │
│  • Backend caches semantically similar questions            │
│  • Both caches update independently                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Cache Comparison

| Feature | Frontend Cache | Backend Cache |
|---------|---------------|---------------|
| **Storage** | localStorage | Disk (JSON) |
| **Scope** | Per-user | All users |
| **Type** | Exact match | Semantic similarity |
| **Speed** | Instant (0ms) | Fast (50ms) |
| **Threshold** | 3+ asks | 92%+ similarity |
| **Multi-step** | Blocked | Not blocked |
| **Persistence** | Browser only | Server-wide |

---

## 💾 Cache Storage Locations

### Frontend (Per User)
```
Browser localStorage:
- agent_max_response_cache
- agent_max_question_frequency
- conversationHistory

Location: Browser's localStorage
Size: ~5-10MB per user
Cleared: When user clears browser data
```

### Backend (Shared)
```
Agent_Max/state/:
- semantic_cache.json         (Semantic similarity cache)
- embeddings_cache.json        (Question embeddings)

Agent_Max/cache_data/:
- response_cache.json          (Response cache)

Size: ~50-100MB (grows with usage)
Cleared: Manual or automatic cleanup
```

---

## 🔧 Stop & Restart Commands

### Stop All Instances

#### Stop Desktop App (agent-max-desktop)
```bash
# macOS
pkill -f "agent-max-desktop"
pkill -f "Electron"

# Or just quit the app normally (Cmd+Q)
```

#### Stop Backend API (Agent_Max)
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/Agent_Max

# Kill all Python API processes
pkill -f "agent_max.py --api"

# Or kill by port
lsof -ti:8000 | xargs kill -9

# Verify it's stopped
curl http://localhost:8000/health
# Should fail with "Connection refused"
```

### Restart Everything

#### Restart Backend API
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/Agent_Max

# Stop existing
pkill -f "agent_max.py --api"
sleep 2

# Start fresh
./venv/bin/python agent_max.py --api > api.log 2>&1 &

# Verify it's running
sleep 3
curl http://localhost:8000/health
```

#### Restart Desktop App
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop

# Stop existing
pkill -f "agent-max-desktop"
sleep 2

# Start fresh
npm run dev
# Or for production build:
npm run electron:start
```

### Complete Restart Script

Create `restart_agent_max.sh`:
```bash
#!/bin/bash

echo "🛑 Stopping Agent Max..."

# Stop desktop app
pkill -f "agent-max-desktop"
pkill -f "Electron"

# Stop backend API
pkill -f "agent_max.py --api"
lsof -ti:8000 | xargs kill -9 2>/dev/null

sleep 3

echo "🚀 Starting Agent Max..."

# Start backend API
cd /Users/colinobrien/Desktop/Coding\ Projects/Agent_Max
./venv/bin/python agent_max.py --api > api.log 2>&1 &

sleep 5

# Verify API is running
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend API started successfully"
else
    echo "❌ Backend API failed to start"
    exit 1
fi

# Start desktop app
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop
npm run electron:start &

echo "✅ Agent Max restarted!"
```

Make it executable:
```bash
chmod +x restart_agent_max.sh
./restart_agent_max.sh
```

---

## 🌐 Deployment Options for Multi-User Support

### Current Setup (Local)
```
❌ Problem: API runs on your computer
❌ Users can't access when your computer is off
❌ Not scalable for multiple concurrent users
```

### Solution Options

---

## Option 1: Cloud Server (Recommended) ⭐

### Best Choice: DigitalOcean Droplet / AWS EC2

**Pros:**
- ✅ Always online (99.9% uptime)
- ✅ Handles multiple users simultaneously
- ✅ Scalable (upgrade as needed)
- ✅ Professional deployment
- ✅ Easy to manage

**Cons:**
- 💰 Monthly cost ($5-20/month)
- 🔧 Requires basic server setup

### Setup Steps:

#### 1. Create Server
```bash
# DigitalOcean Droplet (Recommended)
- Size: Basic ($6/month)
- CPU: 1 vCPU
- RAM: 1GB (start here, upgrade if needed)
- OS: Ubuntu 22.04 LTS

# AWS EC2 (Alternative)
- Instance: t3.micro (free tier eligible)
- OS: Ubuntu 22.04 LTS
```

#### 2. Deploy Backend API
```bash
# SSH into server
ssh root@your-server-ip

# Install dependencies
apt update
apt install -y python3.11 python3-pip git

# Clone your repo (or upload files)
git clone https://github.com/yourusername/Agent_Max.git
cd Agent_Max

# Install Python packages
pip3 install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"

# Run API with systemd (auto-restart)
sudo nano /etc/systemd/system/agent-max-api.service
```

#### 3. Systemd Service File
```ini
[Unit]
Description=Agent Max API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Agent_Max
Environment="OPENAI_API_KEY=your-key"
Environment="ANTHROPIC_API_KEY=your-key"
ExecStart=/usr/bin/python3 agent_max.py --api
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 4. Start Service
```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable agent-max-api
sudo systemctl start agent-max-api

# Check status
sudo systemctl status agent-max-api

# View logs
sudo journalctl -u agent-max-api -f
```

#### 5. Configure Firewall
```bash
# Allow API port
ufw allow 8000/tcp
ufw enable

# Or use nginx reverse proxy (recommended)
apt install -y nginx
```

#### 6. Update Desktop App
```javascript
// src/config/api.js
export const API_BASE_URL = 'https://your-server-ip:8000';
// Or use domain: 'https://api.agentmax.com'
```

### Cost Estimate:
```
DigitalOcean Droplet: $6/month
Domain (optional): $12/year
SSL Certificate: Free (Let's Encrypt)

Total: ~$6-10/month
```

---

## Option 2: Spare Desktop (Budget Option) 💻

**Pros:**
- ✅ Free (use existing hardware)
- ✅ Full control
- ✅ No monthly fees

**Cons:**
- ❌ Power consumption (~$5-10/month)
- ❌ Internet reliability issues
- ❌ No professional uptime guarantee
- ❌ Requires port forwarding
- ❌ Security concerns (exposing home network)

### Setup Steps:

#### 1. Prepare Desktop
```bash
# Install Ubuntu Server 22.04 LTS
# Or use existing OS (macOS/Windows)

# Keep computer always on
# Disable sleep mode
# Ensure stable internet connection
```

#### 2. Install API
```bash
# Same as cloud server setup
cd ~/Agent_Max
./venv/bin/python agent_max.py --api
```

#### 3. Configure Router
```
1. Log into router admin panel
2. Find "Port Forwarding" settings
3. Forward external port 8000 → internal IP:8000
4. Get your public IP: curl ifconfig.me
5. Use dynamic DNS (if IP changes)
```

#### 4. Security
```bash
# Install firewall
ufw enable
ufw allow 8000/tcp

# Use strong passwords
# Keep OS updated
# Consider VPN instead of port forwarding
```

#### 5. Update Desktop App
```javascript
// src/config/api.js
export const API_BASE_URL = 'http://your-public-ip:8000';
```

### Issues:
- 🔌 Power outages = downtime
- 🌐 ISP issues = downtime
- 🔒 Security risks
- 📍 Dynamic IP changes

---

## Option 3: Serverless (Advanced) ☁️

### AWS Lambda + API Gateway

**Pros:**
- ✅ Pay per request (very cheap)
- ✅ Auto-scaling
- ✅ No server management

**Cons:**
- ❌ Complex setup
- ❌ Cold start delays (1-5 seconds)
- ❌ Limited execution time (15 min max)

**Cost:** ~$1-5/month for moderate usage

---

## Option 4: Hybrid (Best of Both) 🎯

### Use Cloud for API + Desktop for Development

```
Production Users → Cloud Server (DigitalOcean)
Development/Testing → Local Desktop
```

**Setup:**
```javascript
// src/config/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.agentmax.com'  // Cloud server
  : 'http://localhost:8000';     // Local development

export default API_BASE_URL;
```

---

## 🎯 Recommendation

### For Your Use Case:

**Start with:** DigitalOcean Droplet ($6/month)

**Why:**
1. ✅ **Always online** - Users can access 24/7
2. ✅ **Scalable** - Upgrade as you grow
3. ✅ **Professional** - Reliable uptime
4. ✅ **Easy** - Simple setup, managed infrastructure
5. ✅ **Affordable** - $6/month is reasonable
6. ✅ **Multi-user** - Handles concurrent requests

**Upgrade Path:**
```
Start: $6/month (1GB RAM, 1 vCPU)
  ↓
Growth: $12/month (2GB RAM, 1 vCPU)
  ↓
Scale: $24/month (4GB RAM, 2 vCPU)
  ↓
Enterprise: Load balancer + multiple servers
```

---

## 📊 Load Capacity Estimates

### $6/month Droplet (1GB RAM, 1 vCPU)
```
Concurrent users: 5-10
Requests/minute: 30-50
Daily active users: 50-100
```

### $12/month Droplet (2GB RAM, 1 vCPU)
```
Concurrent users: 10-20
Requests/minute: 60-100
Daily active users: 100-200
```

### $24/month Droplet (4GB RAM, 2 vCPU)
```
Concurrent users: 20-50
Requests/minute: 100-200
Daily active users: 200-500
```

---

## 🔐 Security Considerations

### For Cloud Deployment:

1. **Environment Variables**
```bash
# Never commit API keys
# Use .env files
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

2. **Firewall**
```bash
# Only allow necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8000/tcp # API
```

3. **SSL/TLS**
```bash
# Use Let's Encrypt for free SSL
certbot --nginx -d api.agentmax.com
```

4. **Rate Limiting**
```python
# Already implemented in your API
# api/routers/screen_control.py
@limiter.limit("15/minute")
```

5. **Authentication**
```python
# Already implemented
# api/dependencies.py
verify_api_key()
```

---

## 🚀 Quick Start: Deploy to DigitalOcean

### 1-Click Deploy (5 minutes)

```bash
# 1. Create droplet on DigitalOcean
# 2. SSH into server
ssh root@your-droplet-ip

# 3. Run this script
curl -sSL https://raw.githubusercontent.com/yourusername/Agent_Max/main/deploy.sh | bash

# 4. Done! API is running
```

### Create `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Deploying Agent Max API..."

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3.11 python3-pip git nginx certbot python3-certbot-nginx

# Clone repo
cd /opt
git clone https://github.com/yourusername/Agent_Max.git
cd Agent_Max

# Install Python packages
pip3 install -r requirements.txt

# Set up environment
read -p "Enter OpenAI API Key: " OPENAI_KEY
read -p "Enter Anthropic API Key: " ANTHROPIC_KEY

cat > .env << EOF
OPENAI_API_KEY=$OPENAI_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
EOF

# Create systemd service
cat > /etc/systemd/system/agent-max-api.service << EOF
[Unit]
Description=Agent Max API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Agent_Max
EnvironmentFile=/opt/Agent_Max/.env
ExecStart=/usr/bin/python3 agent_max.py --api
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable agent-max-api
systemctl start agent-max-api

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw --force enable

echo "✅ Agent Max API deployed successfully!"
echo "🌐 API URL: http://$(curl -s ifconfig.me):8000"
echo "🏥 Health check: http://$(curl -s ifconfig.me):8000/health"
```

---

## 📝 Summary

### Cache Architecture:
- **Frontend:** localStorage, per-user, 3+ asks, blocks multi-step
- **Backend:** Disk storage, shared, semantic similarity

### Stop/Restart:
```bash
# Stop all
pkill -f "agent-max-desktop"
pkill -f "agent_max.py --api"

# Restart
./restart_agent_max.sh
```

### Deployment Recommendation:
**DigitalOcean Droplet ($6/month)**
- Always online
- Multi-user support
- Scalable
- Professional

### Next Steps:
1. Create DigitalOcean account
2. Deploy using script above
3. Update desktop app API URL
4. Test with multiple users
5. Monitor and scale as needed

**Your spare desktop is better used for development/testing, not production!** 🎯
