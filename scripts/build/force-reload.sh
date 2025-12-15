#!/bin/bash

echo "🔄 Force reloading Agent Max with fresh CSS..."

# Kill all Electron processes
echo "1️⃣ Killing Electron..."
pkill -9 -f "Electron" 2>/dev/null || true
pkill -9 -f "agent-max" 2>/dev/null || true

# Clear Vite cache
echo "2️⃣ Clearing Vite cache..."
rm -rf node_modules/.vite
rm -rf .vite

# Clear any browser/Electron cache
echo "3️⃣ Clearing Electron cache..."
rm -rf ~/Library/Application\ Support/agent-max-desktop 2>/dev/null || true

echo "✅ Cache cleared!"
echo ""
echo "Now run:"
echo "  npm run dev"
echo "Then in another terminal:"
echo "  npm run electron:dev"
