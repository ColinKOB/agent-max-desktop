#!/bin/bash
# Delete dead frontend code safely
# Run: chmod +x delete_dead_code.sh && ./delete_dead_code.sh

set -e  # Exit on error

echo "🗑️  Agent Max - Dead Code Deletion Script"
echo "=========================================="
echo ""

# Confirm
read -p "This will delete 2,458 LOC of unused code. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "📦 Step 1: Creating backup..."
mkdir -p archive/pages
mkdir -p archive/components
mkdir -p archive/services
mkdir -p archive/hooks

# Backup everything we're about to delete
cp src/pages/Dashboard.jsx archive/pages/ 2>/dev/null || echo "  ⚠️  Dashboard.jsx not found"
cp src/pages/Conversation.jsx archive/pages/ 2>/dev/null || echo "  ⚠️  Conversation.jsx not found"
cp src/pages/Knowledge.jsx archive/pages/ 2>/dev/null || echo "  ⚠️  Knowledge.jsx not found"
cp src/pages/Search.jsx archive/pages/ 2>/dev/null || echo "  ⚠️  Search.jsx not found"
cp src/pages/Preferences.jsx archive/pages/ 2>/dev/null || echo "  ⚠️  Preferences.jsx not found"

cp src/components/Sidebar.jsx archive/components/ 2>/dev/null || echo "  ⚠️  Sidebar.jsx not found"
cp src/components/WelcomeScreen.jsx archive/components/ 2>/dev/null || echo "  ⚠️  WelcomeScreen.jsx not found"
cp src/components/ChatInterface.jsx archive/components/ 2>/dev/null || echo "  ⚠️  ChatInterface.jsx not found"
cp src/components/FactsManager.jsx archive/components/ 2>/dev/null || echo "  ⚠️  FactsManager.jsx not found"

cp src/services/streaming.js archive/services/ 2>/dev/null || echo "  ⚠️  streaming.js not found"
cp src/services/requestQueue.js archive/services/ 2>/dev/null || echo "  ⚠️  requestQueue.js not found"

cp -r src/hooks archive/ 2>/dev/null || echo "  ⚠️  hooks/ not found"

echo "✅ Backup created in archive/"
echo ""

echo "🗑️  Step 2: Deleting unused pages..."
rm -f src/pages/Dashboard.jsx
rm -f src/pages/Conversation.jsx
rm -f src/pages/Knowledge.jsx
rm -f src/pages/Search.jsx
rm -f src/pages/Preferences.jsx
echo "✅ Deleted 5 pages (1,379 LOC)"

echo ""
echo "🗑️  Step 3: Deleting unused components..."
rm -f src/components/Sidebar.jsx
rm -f src/components/WelcomeScreen.jsx
rm -f src/components/ChatInterface.jsx
rm -f src/components/FactsManager.jsx
echo "✅ Deleted 4 components (764 LOC)"

echo ""
echo "🗑️  Step 4: Deleting unused services..."
rm -f src/services/streaming.js
rm -f src/services/requestQueue.js
echo "✅ Deleted 2 services (248 LOC)"

echo ""
echo "🗑️  Step 5: Deleting unused hooks..."
rm -rf src/hooks
echo "✅ Deleted hooks directory (67 LOC)"

echo ""
echo "=========================================="
echo "✅ DELETION COMPLETE!"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  - Deleted: ~2,458 LOC (60% reduction)"
echo "  - Kept: ~1,665 LOC (40% active code)"
echo "  - Backup: archive/ folder"
echo ""
echo "📝 Next Steps:"
echo "  1. Test: npm run electron:dev"
echo "  2. Verify: FloatBar still works"
echo "  3. Update: README.md (see DELETE_SUMMARY.md)"
echo "  4. Commit: git add . && git commit -m 'Remove dead code'"
echo ""
echo "🔄 To restore: cp -r archive/* src/"
echo ""
echo "✨ Your codebase is now 60% leaner!"
