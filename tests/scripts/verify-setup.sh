#!/bin/bash

# Agent Max Desktop - Setup Verification Script
# This script checks if everything is properly set up

echo "🔍 Agent Max Desktop - Setup Verification"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -n "Checking Node.js installation... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Found: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check npm
echo -n "Checking npm installation... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} Found: v$NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Check if node_modules exists
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Dependencies not installed"
    echo "Run: npm install"
fi

# Check if Agent Max API is running
echo -n "Checking Agent Max API... "
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} API is running on port 8000"
else
    echo -e "${YELLOW}⚠${NC} API not detected on port 8000"
    echo "Start the API with: cd ../Agent_Max && python agent_max.py --api"
fi

# Check required files
echo ""
echo "Checking project files:"

FILES=(
    "package.json"
    "vite.config.js"
    "tailwind.config.js"
    "electron/main.cjs"
    "electron/preload.cjs"
    "src/App.jsx"
    "src/main.jsx"
    "src/services/api.js"
    "src/store/useStore.js"
    "index.html"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
    fi
done

# Check pages
echo ""
echo "Checking pages:"
PAGES=("Dashboard" "Conversation" "Knowledge" "Search" "Preferences" "Settings")
for page in "${PAGES[@]}"; do
    if [ -f "src/pages/$page.jsx" ]; then
        echo -e "  ${GREEN}✓${NC} $page"
    else
        echo -e "  ${RED}✗${NC} $page (missing)"
    fi
done

# Check components
echo ""
echo "Checking components:"
COMPONENTS=("Sidebar" "ProfileCard" "ChatInterface" "FactsManager")
for component in "${COMPONENTS[@]}"; do
    if [ -f "src/components/$component.jsx" ]; then
        echo -e "  ${GREEN}✓${NC} $component"
    else
        echo -e "  ${RED}✗${NC} $component (missing)"
    fi
done

echo ""
echo "=========================================="
echo ""

# Final status
if [ -d "node_modules" ] && curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Setup complete! Ready to run.${NC}"
    echo ""
    echo "Start the app with:"
    echo "  npm run electron:dev"
else
    echo -e "${YELLOW}⚠️  Setup incomplete.${NC}"
    echo ""
    if [ ! -d "node_modules" ]; then
        echo "1. Install dependencies: npm install"
    fi
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "2. Start Agent Max API: cd ../Agent_Max && python agent_max.py --api"
    fi
    echo "3. Then run: npm run electron:dev"
fi

echo ""
