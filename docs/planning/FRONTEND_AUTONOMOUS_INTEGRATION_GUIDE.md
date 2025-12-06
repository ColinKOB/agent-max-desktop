# Frontend Integration Guide: Autonomous Tool Execution

**Date**: November 5, 2024  
**Backend Status**: ✅ Deployed and tested in production  
**API Endpoint**: `https://agentmax-production.up.railway.app/api/v2/agent/execute/stream` 

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Event Types](#event-types)
4. [Implementation Guide](#implementation-guide)
5. [Verification Steps](#verification-steps)
6. [Troubleshooting](#troubleshooting)
7. [Example Code](#example-code)

---

## Overview

The Agent Max backend now supports **autonomous tool execution**, where the AI can:
- Read and write files on the server
- List directories
- Execute other filesystem operations
- **Future**: Shell commands, HTTP requests, browser automation

### How It Works

```
User Request → AI Response with fs_command blocks → Backend Parses & Executes → exec_log Events
```

**Example:**
```
User: "Create a file called test.txt on my desktop with Hello World"

AI Response (streamed tokens):
```fs_command
{"action": "fs.write", "args": {"path": "~/Desktop/test.txt", "content": "Hello World"}}
```

Backend:
1. Parses the fs_command block
2. Validates the action
3. Executes fs.write
4. Emits exec_log event: "Executed fs.write: ok"
```

---

## What Changed

### Before (Old System)
- AI would say: "I can't directly access your files"
- No actual file operations
- User had to manually execute commands

### Now (New System)
- AI knows it CAN access files
- AI outputs `fs_command` blocks
- **Backend executes automatically** (when `flags.server_fs = true`)
- Frontend receives `exec_log` events showing results

### Frontend Changes Needed

**You must handle new SSE event types:**
- `exec_log` - Action execution results (new!)
- Parse results debug info (status: "info")

**Optional (for future):**
- Desktop-side execution (when `flags.server_fs = false`)
- Action approval UI for destructive operations

---

## Event Types

### 1. `ack` - Stream Started
```json
{
  "type": "ack",
  "message": "autonomous_stream_started"
}
```
**Action**: Show "AI is thinking..." indicator

---

### 2. `plan`  - Execution Plan
```json
{
  "type": "plan",
  "plan_id": "plan_abc123",
  "steps": [
    {
      "step_id": "plan_abc123_s1",
      "description": "Complete request",
      "goal": "Create test.txt file"
    }
  ],
  "confidence": 0.75,
  "budget": {
    "max_steps": 1000,
    "max_cost_usd": 999.0,
    "max_tokens": 999999
  }
}
```
**Action**: Optionally show plan steps to user

---

### 3. `token`  - Streaming Response (Existing)
```json
{
  "type": "token",
  "content": "Creating"
}
```
**Action**: Append to response buffer and display

---

### 4. `exec_log`  - Action Execution (NEW!)

#### 4a. Parse Debug Info
```json
{
  "type": "exec_log",
  "plan_id": "plan_abc123",
  "step_id": "plan_abc123_s1",
  "status": "info",
  "message": "Parse: 2 action(s) found | server_fs=ON",
  "t_ms": 0.0
}
```
**Action**: Log for debugging (optional to show user)

#### 4b. Action Completed
```json
{
  "type": "exec_log",
  "plan_id": "plan_abc123",
  "step_id": "plan_abc123_s1",
  "status": "completed",
  "message": "Executed fs.write: ok",
  "t_ms": 5.0
}
```
**Action**: Show "✅ File created" or similar success indicator

#### 4c. Action Failed
```json
{
  "type": "exec_log",
  "plan_id": "plan_abc123",
  "step_id": "plan_abc123_s1",
  "status": "failed",
  "message": "Executed fs.read: read error: [Errno 2] No such file or directory",
  "t_ms": 2.0
}
```
**Action**: Show "❌ Error: File not found" to user

#### 4d. Action Queued (Needs Approval)
```json
{
  "type": "exec_log",
  "plan_id": "plan_abc123",
  "step_id": "plan_abc123_s1",
  "status": "queued",
  "message": "Action requires approval: sh.run",
  "t_ms": 0.0
}
```
**Action**: Show approval prompt (future: "AI wants to run shell command. Allow?")

---

### 5. `final`  - Completion Summary
```json
{
  "type": "final",
  "plan_id": "plan_abc123",
  "summary": "Completed 1 step(s) successfully",
  "outputs": {
    "response": "I've created the file for you.",
    "reasoning_tokens": null
  },
  "confidence": 0.75,
  "tokens_in": 0,
  "tokens_out": 45,
  "cost_usd": null,
  "total_ms": 3500.0
}
```
**Action**: Show completion, log metrics

---

### 6. `done`  - Stream Complete
```json
{
  "type": "done",
  "data": {
    "final_response": "I've created test.txt on your desktop with 'Hello World'."
  }
}
```
**Action**: Hide loading, enable input, show final response

---

## Quick Verification Test

```bash
curl -N -X POST "https://agentmax-production.up.railway.app/api/v2/agent/execute/stream" \
  -H "x-api-key: e341a4acb41aa9c80b4baba442b0a24e8d1ce9fa7b4e5307ed34ef2aa15258f0" \
  -H "Content-Type: application/json" \
  -H "X-Events-Version: 1.1" \
  -d '{
    "message": "Create a file called test.txt with Hello World",
    "mode": "autonomous",
    "flags": {"server_fs": true}
  }'
```

**Expected**: You should see `exec_log` events with status "completed" showing file operations.

---

**Status**: ✅ Production Ready  
**Last Updated**: November 5, 2024  
**Version**: 1.0
