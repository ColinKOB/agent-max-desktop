# Desktop-Side Execution Implementation Checklist

**Goal**: Make desktop the "hands" that execute file operations locally, while backend acts as the "brain"

**Date Started**: 2025-11-05  
**Status**: 🚧 IN PROGRESS

---

## Phase 1: Backend Communication Changes ✅

### 1.1 Switch to Desktop-Side Execution Flag
- [x] Change `flags.server_fs: true` → `flags.server_fs: false` in `src/services/api.js`
- [x] Verify flag is sent correctly in API requests
- [ ] Test that backend emits `exec_log` events with status "queued" instead of executing (will test in Phase 5)

---

## Phase 2: Electron Executor Extensions ✅

### 2.1 Add Filesystem Operations to LocalExecutor
- [x] Add `fs.write` - Create/overwrite file with content
- [x] Add `fs.read` - Read file contents and return as string
- [x] Add `fs.append` - Append content to existing file
- [x] Add `fs.list` - List directory contents
- [x] Add `fs.delete` - Delete file (safe guards)
 - [x] Add `sh.run` - Execute shell commands via child_process.exec (with timeout & buffer limits)

### 2.2 Path Safety & Resolution
- [x] Implement path normalization (resolve `~`, `.`, `..`)
- [x] Implement path validation (block traversal outside home for now)
- [x] Add error handling for permission denied, not found, etc.
- [ ] Test with various path formats (relative, absolute, `~`) (will test in Phase 5)

### 2.3 Executor Testing
- [ ] Unit test each fs.* action in isolation (skipping unit tests for now, will do E2E)
- [ ] Test error cases (missing file, permission denied, invalid path) (will test in Phase 5)
- [x] Verify base64 encoding/decoding for binary files (implemented, not tested yet)

---

## Phase 3: Frontend Event Parsing & IPC ✅

### 3.1 Extract fs_command Blocks from AI Response
- [x] Add regex parser in AppleFloatBar to extract ```fs_command blocks
- [x] Parse JSON from extracted block
- [x] Validate action structure `{action: "fs.write", args: {...}}`
- [x] Handle multiple fs_command blocks in single response

### 3.2 Wire IPC Communication
- [x] Call `window.electron.memory.autonomous.execute()` when fs_command detected
- [x] Handle IPC response (success/failure)
- [x] Update UI based on execution result

### 3.3 Event Handler Updates
- [x] Add logic to detect when AI outputs fs_command (token stream)
- [x] Trigger execution when command is complete (done event + periodic checks)
- [x] Display results in UI (success/failure toasts)
- [x] Clear accumulated response on new stream start

### 3.4 Exec Log Queued → Local Execution
- [x] Handle `exec_log` events with `status="queued"`
- [x] Parse `action_type` and `action_args` when present; fallback to message parse for type
- [x] Normalize action to `{ type, args }` for executor compatibility
- [x] Execute via `window.electron.memory.autonomous.execute()` (IPC → LocalExecutor)
- [x] Attempt result callback POST to `/api/v2/agent/action-result` when available (safe no-op if missing)

### 3.5 Stream v2.1 Support ✅
- [x] Send `X-Stream-Id` and (when resuming) `Last-Sequence-Seen`
- [x] Handle `metadata` events (e.g., `resume_unavailable`)
- [x] Surface `final` metrics: `tokens_out`, `total_ms`, `tokens_in`, `cost_usd`, `checksum`

---

## Phase 4: UI/UX Integration ✅

### 4.1 Toast Notifications
- [x] Info toast shows "🔧 Executing fs.write..." (or other action)
- [x] Success toast shows "✅ File created/read/updated/listed/deleted"
- [x] Error toast shows "❌ Error: [details]"
- [x] Glassmorphism styling applied

### 4.2 Thinking Status & Thought History
- [x] Log all actions to thought history with ✅/❌ prefix
- [x] Show file paths and results in thoughts

### 4.3 Response Display
- [x] Show file contents when read operation completes (in thoughts with preview)
- [x] Show directory listing when list operation completes (formatted with icons)
- [x] Show execution results in thought history
- [x] Execution Details panel (collapsible): shows action, command, exit code, stdout/stderr with Copy buttons; does not pollute Thoughts

---

## Phase 5: Testing & Validation

### 5.1 Basic File Operations
- [ ] Test: "Create test.txt with Hello World"
  - Expected: File created at ~/test.txt
  - Toast: "✅ File created"
  - Verify file exists with correct content

- [ ] Test: "Read test.txt"
  - Expected: File contents displayed in response
  - Toast: "✅ File read"
  
- [ ] Test: "Append 'Line 2' to test.txt"
  - Expected: Content appended
  - Toast: "✅ File updated"
  - Verify file has both lines

- [ ] Test: "List files in Desktop directory"
  - Expected: Directory contents displayed
  - Toast: "✅ Directory listed"

- [ ] Test: "Delete test.txt"
  - Expected: File removed
  - Toast: "✅ File deleted"
  - Verify file is gone

### 5.2 Error Handling
- [ ] Test: "Read nonexistent_file.txt"
  - Expected: Error toast with "File not found"
  - Response acknowledges error gracefully

- [ ] Test: "Write to /root/test.txt" (permission denied)
  - Expected: Error toast with permission error
  - No system damage

- [ ] Test: Invalid path "../../../etc/passwd"
  - Expected: Path validation blocks it
  - Error toast shown

### 5.3 Edge Cases
- [ ] Test: Multiple fs_command blocks in one response
- [ ] Test: Large file operations (>1MB)
- [ ] Test: Special characters in filenames
- [ ] Test: Unicode content in files
- [ ] Test: Binary file handling (base64)
- [x] Test: Shell command execution via `sh.run` (smoke test: `echo hello-from-localexecutor`)

### 5.4 Shell Command Safety
- [x] Test: "Run echo hello-from-localexecutor"
  - Expected: Executed locally via `sh.run`, stdout captured
  - Result: PASS (stdout: "hello-from-localexecutor")
  - Notes: Execution uses `child_process.exec` with 60s timeout and 10MB buffer cap. No browser init required.

---

## Phase 6: Documentation & Cleanup

### 6.1 Code Documentation
- [ ] Add JSDoc comments to new executor methods
- [ ] Document IPC contract in comments
- [ ] Add inline comments for complex logic

### 6.2 Project Documentation
- [ ] Create Desktop_Side_Execution_Complete.md summary
- [ ] Update agents.md with new architecture
- [ ] Create quick test guide for manual validation
- [ ] Document safety measures and limitations

### 6.3 Code Quality
- [ ] Run linter on modified files
- [ ] Remove debug console.logs (or use logger)
- [ ] Ensure no hardcoded paths or test data
- [ ] Check for memory leaks (file handles, etc.)

---

## Phase 7: Integration Testing

### 7.1 End-to-End Flow
- [ ] Full flow: User prompt → AI generates fs_command → Desktop executes → UI shows result
- [ ] Test in production-like environment
- [ ] Verify no regressions in chat/helpful modes
- [ ] Test with real user scenarios

### 7.2 Performance
- [ ] Measure execution latency (should be <100ms for local ops)
- [ ] Test concurrent operations
- [ ] Verify no UI blocking during file ops

### 7.3 Telemetry
- [ ] Log execution events to telemetry
- [ ] Track success/failure rates
- [ ] Monitor performance metrics

---

## Success Criteria

**Must Have:**
- ✅ Desktop executes fs.write, fs.read, fs.append, fs.list locally
- ✅ UI shows clear feedback for all operations
- ✅ Path safety prevents system damage
- ✅ Error handling is robust and user-friendly
- ✅ No regressions in existing functionality

**Nice to Have:**
- ⭐ fs.delete working safely
- ⭐ Binary file support (base64)
- ⭐ Concurrent operation handling
- ⭐ Progress indicators for large files

---

## Notes

- **Current State**: Server-side execution working, now switching to desktop-side
- **Backend Role**: Parse fs_command, emit exec_log with status "queued", let desktop handle
- **Desktop Role**: Execute actions locally, show results, maintain security
- **No Approval Dialogs**: Skipping for initial validation (will add later)
- **Path Scope**: Home directory only for now (can expand later)

---

## Progress Tracking

**Phase 1**: ✅ COMPLETE - Backend communication changes  
**Phase 2**: ✅ COMPLETE - Electron executor extensions  
**Phase 3**: ✅ COMPLETE - Frontend event parsing & IPC  
**Phase 4**: ✅ COMPLETE - UI/UX integration  
**Phase 5**: 🚧 IN PROGRESS - Testing & Validation  
**Phase 6**: ⬜ Not Started - Documentation & Cleanup  
**Phase 7**: ⬜ Not Started - Integration Testing

**Time Elapsed**: ~45 minutes  
**Remaining**: Testing, documentation, integration  
**Priority**: Quality over speed ⭐
