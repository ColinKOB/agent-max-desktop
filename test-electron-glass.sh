#!/bin/bash

echo "🧪 Testing Electron + backdrop-filter directly..."
echo ""
echo "This will open a test window with glass effect."
echo "Look at your DESKTOP behind the window - it should be BLURRED."
echo ""
echo "Press Ctrl+C to stop after testing."
echo ""

# Run the test window
npx electron electron/test-window.cjs
