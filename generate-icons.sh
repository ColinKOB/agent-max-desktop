#!/bin/bash

# Generate macOS .icns from source PNG
# Usage: ./generate-icons.sh

echo "🎨 Generating macOS app icons..."

# Check if source icon exists
if [ ! -f "AgentMaxLogo.png" ]; then
  echo "❌ Error: AgentMaxLogo.png not found"
  exit 1
fi

# Create build directory if it doesn't exist
mkdir -p build

# Create iconset directory
rm -rf app.iconset
mkdir app.iconset

echo "📐 Creating icon sizes..."

# Generate all required sizes
sips -z 16 16     AgentMaxLogo.png --out app.iconset/icon_16x16.png
sips -z 32 32     AgentMaxLogo.png --out app.iconset/icon_16x16@2x.png
sips -z 32 32     AgentMaxLogo.png --out app.iconset/icon_32x32.png
sips -z 64 64     AgentMaxLogo.png --out app.iconset/icon_32x32@2x.png
sips -z 128 128   AgentMaxLogo.png --out app.iconset/icon_128x128.png
sips -z 256 256   AgentMaxLogo.png --out app.iconset/icon_128x128@2x.png
sips -z 256 256   AgentMaxLogo.png --out app.iconset/icon_256x256.png
sips -z 512 512   AgentMaxLogo.png --out app.iconset/icon_256x256@2x.png
sips -z 512 512   AgentMaxLogo.png --out app.iconset/icon_512x512.png
sips -z 1024 1024 AgentMaxLogo.png --out app.iconset/icon_512x512@2x.png

echo "🔨 Converting to .icns..."

# Convert iconset to .icns
iconutil -c icns app.iconset -o build/icon.icns

# Clean up
rm -rf app.iconset

echo "✅ Icon generated: build/icon.icns"
echo ""
echo "📝 Next steps:"
echo "1. Run: npm run build"
echo "2. Clear icon cache: killall Dock; killall Finder"
echo "3. Test the app"
