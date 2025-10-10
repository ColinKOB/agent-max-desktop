#!/bin/bash

echo "🚀 Starting Agent Max Electron App..."
echo ""

# Change to script directory (works on any machine)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  Dependencies not installed. Installing now..."
    npm install
fi

# Start app
echo "Starting Electron app..."
npm run electron:dev
