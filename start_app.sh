#!/bin/bash

echo "🚀 Starting Agent Max Electron App..."
echo ""

cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  Dependencies not installed. Installing now..."
    npm install
fi

# Start app
echo "Starting Electron app..."
npm run electron:dev
