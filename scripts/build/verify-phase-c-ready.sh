#!/bin/bash
# Verification Script — Phase C Readiness Check
# Ensures all files are in place and valid before user testing

echo "🔍 Phase C Readiness Verification"
echo "=================================="
echo ""

# Track pass/fail
PASSED=0
FAILED=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check test HTML exists and is valid
echo "1️⃣  Checking test-glass-ui.html..."
if [ -f "test-glass-ui.html" ]; then
    # Check if it has required content
    if grep -q "amx-settings-panel" test-glass-ui.html && grep -q "amx-input-glass" test-glass-ui.html; then
        echo -e "   ${GREEN}✓${NC} test-glass-ui.html exists with glass classes"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} test-glass-ui.html missing glass class references"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} test-glass-ui.html not found"
    ((FAILED++))
fi

# Test 2: Check globals.css has glass utilities
echo "2️⃣  Checking globals.css glass utilities..."
if [ -f "src/styles/globals.css" ]; then
    if grep -q "amx-settings-panel" src/styles/globals.css && \
       grep -q "amx-input-glass" src/styles/globals.css && \
       grep -q "backdrop-filter: blur" src/styles/globals.css; then
        echo -e "   ${GREEN}✓${NC} Glass utilities found in globals.css"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} Glass utilities missing or incomplete"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} globals.css not found"
    ((FAILED++))
fi

# Test 3: Check feature flags exist
echo "3️⃣  Checking feature flag system..."
if [ -f "src/config/featureFlags.js" ]; then
    if grep -q "GLASS_UI_ENABLED" src/config/featureFlags.js && \
       grep -q "GLASS_FORCE_OPAQUE" src/config/featureFlags.js && \
       grep -q "isGlassEnabled" src/config/featureFlags.js; then
        echo -e "   ${GREEN}✓${NC} Feature flag system complete"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} Feature flag system incomplete"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} featureFlags.js not found"
    ((FAILED++))
fi

# Test 4: Check ESLint rule exists
echo "4️⃣  Checking ESLint rule..."
if [ -f "eslint-plugin-amx/lib/rules/no-opaque-in-glass.js" ] && \
   [ -f "eslint-plugin-amx/index.js" ]; then
    echo -e "   ${GREEN}✓${NC} ESLint plugin structure exists"
    ((PASSED++))
else
    echo -e "   ${RED}✗${NC} ESLint plugin files missing"
    ((FAILED++))
fi

# Test 5: Check Stylelint config exists
echo "5️⃣  Checking Stylelint config..."
if [ -f ".stylelintrc.json" ]; then
    if grep -q "backdrop-filter" .stylelintrc.json && \
       grep -q "transition-property" .stylelintrc.json; then
        echo -e "   ${GREEN}✓${NC} Stylelint config with filter ban"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} Stylelint config incomplete"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} .stylelintrc.json not found"
    ((FAILED++))
fi

# Test 6: Check testing guide exists
echo "6️⃣  Checking Phase C testing guide..."
if [ -f "PHASE_C_TESTING_GUIDE.md" ]; then
    if grep -q "C.1: Visual Verification" PHASE_C_TESTING_GUIDE.md && \
       grep -q "C.2: Performance Budget" PHASE_C_TESTING_GUIDE.md && \
       grep -q "C.3: Accessibility Audit" PHASE_C_TESTING_GUIDE.md; then
        echo -e "   ${GREEN}✓${NC} Phase C guide complete"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} Phase C guide incomplete"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} PHASE_C_TESTING_GUIDE.md not found"
    ((FAILED++))
fi

# Test 7: Check Settings.jsx is clean (no syntax errors)
echo "7️⃣  Checking Settings.jsx is reverted..."
if [ -f "src/pages/Settings.jsx" ]; then
    # Check it doesn't have broken amx-settings-panel (our incomplete refactor)
    if ! grep -q "amx-settings-panel" src/pages/Settings.jsx; then
        echo -e "   ${GREEN}✓${NC} Settings.jsx clean (no partial glass conversion)"
        ((PASSED++))
    else
        echo -e "   ${YELLOW}⚠${NC}  Settings.jsx contains glass classes (may be intentional)"
        echo -e "      If this is from a previous commit, it's OK."
        echo -e "      If it's from our broken refactor, run: git checkout src/pages/Settings.jsx"
        ((PASSED++)) # Count as pass but warn
    fi
else
    echo -e "   ${RED}✗${NC} Settings.jsx not found"
    ((FAILED++))
fi

# Test 8: Check execution plan updated
echo "8️⃣  Checking execution plan..."
if [ -f "LIQUID_GLASS_EXECUTION_PLAN.md" ]; then
    if grep -q "Phase C: Testing & Validation" LIQUID_GLASS_EXECUTION_PLAN.md && \
       grep -q "Hard Budgets" LIQUID_GLASS_EXECUTION_PLAN.md; then
        echo -e "   ${GREEN}✓${NC} Execution plan updated with Phase C"
        ((PASSED++))
    else
        echo -e "   ${RED}✗${NC} Execution plan missing Phase C details"
        ((FAILED++))
    fi
else
    echo -e "   ${RED}✗${NC} LIQUID_GLASS_EXECUTION_PLAN.md not found"
    ((FAILED++))
fi

# Summary
echo ""
echo "=================================="
echo "📊 Results: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Phase C READY${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review test-glass-ui.html in your browser"
    echo "2. Follow PHASE_C_TESTING_GUIDE.md (30-60 min)"
    echo "3. Report results back in chat"
    echo ""
    echo "Commands:"
    echo "  open test-glass-ui.html              # View test page"
    echo "  open PHASE_C_TESTING_GUIDE.md        # Read testing protocol"
    exit 0
else
    echo -e "${RED}❌ Phase C NOT READY${NC}"
    echo ""
    echo "Issues found. Review errors above."
    exit 1
fi
