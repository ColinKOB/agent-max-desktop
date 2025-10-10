#!/bin/bash
# Integration Verification Script for Agent Max Desktop
# Tests backend API connectivity and key endpoints

echo "🔍 Agent Max Desktop - Integration Verification"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

# Test 1: Backend Health
echo "📡 Testing Backend Connection"
echo "------------------------------"
test_endpoint "Health Check" "GET" "http://localhost:8000/health"
echo ""

# Test 2: Autonomous Endpoint
echo "🤖 Testing Chat Endpoint"
echo "-------------------------"
test_endpoint "Autonomous Execute" "POST" "http://localhost:8000/api/v2/autonomous/execute" \
    '{"goal": "test connection", "max_steps": 1}'
echo ""

# Test 3: Semantic Search
echo "🔍 Testing Semantic Search"
echo "--------------------------"
test_endpoint "Semantic Similar" "POST" "http://localhost:8000/api/v2/semantic/similar" \
    '{"goal": "test", "threshold": 0.7, "limit": 3}'
echo ""

# Test 4: Profile Endpoint
echo "👤 Testing Profile Endpoint"
echo "---------------------------"
test_endpoint "Get Profile" "GET" "http://localhost:8000/api/v2/profile"
echo ""

# Summary
echo "=============================================="
echo "📊 Test Summary"
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
    echo "Backend API is healthy and all endpoints are working."
    echo ""
    echo "Next steps:"
    echo "1. Make sure app is running: npm run electron:dev"
    echo "2. Perform manual testing (see DEEP_TESTING_REPORT.md)"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo "Please check that the backend API is running:"
    echo "  cd ../Agent_Max"
    echo "  python agent_max.py --api"
    exit 1
fi
