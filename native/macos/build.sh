#!/bin/bash
# Build script for Virtual Display native module

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Building Virtual Display Native Module ==="

# Check for Xcode Command Line Tools
if ! xcode-select -p &> /dev/null; then
    echo "Error: Xcode Command Line Tools not installed."
    echo "Run: xcode-select --install"
    exit 1
fi

# Check macOS version
MACOS_VERSION=$(sw_vers -productVersion | cut -d. -f1)
if [ "$MACOS_VERSION" -lt 12 ]; then
    echo "Error: macOS 12 (Monterey) or later required."
    echo "Current version: $(sw_vers -productVersion)"
    exit 1
fi

echo "1. Building Swift library..."
swift build -c release

echo "2. Checking for node-addon-api..."
if [ ! -d "../../node_modules/node-addon-api" ]; then
    echo "   Installing node-addon-api..."
    cd ../..
    npm install node-addon-api node-gyp --save-dev
    cd native/macos
fi

echo "3. Building Node.js addon..."
cd "$SCRIPT_DIR"
npx node-gyp rebuild

echo "4. Verifying build..."
if [ -f "build/Release/virtual_display.node" ]; then
    echo "✓ Build successful!"
    echo "  Output: build/Release/virtual_display.node"
else
    echo "✗ Build failed - addon not found"
    exit 1
fi

echo ""
echo "=== Build Complete ==="
echo "The native module is ready to use."
echo ""
echo "Test with:"
echo "  node -e \"const vd = require('./index.cjs'); console.log('Supported:', vd.isSupported())\""
