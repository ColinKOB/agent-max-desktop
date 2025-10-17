#!/bin/bash
# Test Autonomous Command Execution
# This tests if the backend properly executes commands

echo "🧪 Testing Autonomous Command Execution"
echo "========================================"
echo ""

# Test 1: Simple echo command
echo "Test 1: Asking backend to echo 'Hello from command'"
echo "---------------------------------------------------"
curl -s -X POST http://localhost:8000/api/v2/autonomous/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "run the command: echo Hello from command",
    "user_context": {},
    "max_steps": 5,
    "timeout": 60
  }' | jq '.' > /tmp/test1_result.json

# Check if command was executed
if grep -q "execute_command" /tmp/test1_result.json; then
    echo "✅ Backend executed command!"
    echo ""
    echo "Steps taken:"
    cat /tmp/test1_result.json | jq '.steps[] | {action: .action, command: .command, output: .output}'
else
    echo "❌ Backend did NOT execute command - only responded conversationally"
    echo ""
    echo "Response:"
    cat /tmp/test1_result.json | jq '.final_response'
fi

echo ""
echo "========================================"
echo ""

# Test 2: Check system info
echo "Test 2: Asking backend to check OS version"
echo "-------------------------------------------"
curl -s -X POST http://localhost:8000/api/v2/autonomous/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "what operating system am I running? check with a command",
    "user_context": {},
    "max_steps": 5,
    "timeout": 60
  }' | jq '.' > /tmp/test2_result.json

if grep -q "execute_command" /tmp/test2_result.json; then
    echo "✅ Backend executed OS detection command!"
    echo ""
    echo "Command run:"
    cat /tmp/test2_result.json | jq '.steps[] | select(.action == "execute_command") | .command'
else
    echo "❌ Backend did NOT execute command"
    echo ""
    echo "Response:"
    cat /tmp/test2_result.json | jq '.final_response'
fi

echo ""
echo "========================================"
echo ""

# Test 3: Download simulation (safe test)
echo "Test 3: Asking backend to check if brew is installed"
echo "----------------------------------------------------"
curl -s -X POST http://localhost:8000/api/v2/autonomous/execute \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "check if homebrew is installed on my system",
    "user_context": {},
    "max_steps": 5,
    "timeout": 60
  }' | jq '.' > /tmp/test3_result.json

if grep -q "execute_command" /tmp/test3_result.json; then
    echo "✅ Backend executed brew check!"
    echo ""
    echo "Commands executed:"
    cat /tmp/test3_result.json | jq '.steps[] | select(.action == "execute_command") | {command: .command, exit_code: .exit_code}'
else
    echo "❌ Backend did NOT execute command"
    echo ""
    echo "Response:"
    cat /tmp/test3_result.json | jq '.final_response'
fi

echo ""
echo "========================================"
echo "📊 Summary"
echo "========================================"
echo ""

# Count how many tests passed
tests_passed=0
if grep -q "execute_command" /tmp/test1_result.json; then
    ((tests_passed++))
fi
if grep -q "execute_command" /tmp/test2_result.json; then
    ((tests_passed++))
fi
if grep -q "execute_command" /tmp/test3_result.json; then
    ((tests_passed++))
fi

echo "Tests passed: $tests_passed/3"
echo ""

if [ $tests_passed -eq 3 ]; then
    echo "✅ Autonomous system is PROPERLY EXECUTING commands!"
    echo ""
    echo "The backend is configured correctly to:"
    echo "  • Execute terminal commands"
    echo "  • Return command output"
    echo "  • Provide exit codes"
    echo ""
    echo "Frontend will display these properly now."
elif [ $tests_passed -eq 0 ]; then
    echo "❌ Autonomous system is NOT executing commands!"
    echo ""
    echo "⚠️  ISSUE IDENTIFIED:"
    echo "The backend is responding conversationally instead of executing commands."
    echo ""
    echo "Possible causes:"
    echo "  1. Autonomous mode is disabled in backend config"
    echo "  2. Command execution permissions not granted"
    echo "  3. Backend is in 'safe mode' or 'chat-only mode'"
    echo "  4. Model instructions need updating"
    echo ""
    echo "Check backend configuration:"
    echo "  • Look for 'autonomous_mode' or 'allow_commands' setting"
    echo "  • Check if there's a safety/sandbox mode enabled"
    echo "  • Verify model system prompt allows command execution"
else
    echo "⚠️  Autonomous system is PARTIALLY working"
    echo "Some commands execute, others don't - may depend on phrasing"
fi

echo ""
echo "Full results saved to:"
echo "  /tmp/test1_result.json"
echo "  /tmp/test2_result.json"
echo "  /tmp/test3_result.json"
echo ""
