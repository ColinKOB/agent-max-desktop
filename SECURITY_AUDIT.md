# Security Audit Report — Agent Max Desktop

**Date:** 2026-02-07
**Auditor:** Automated (Claude)
**Scope:** Full codebase (~115,000 LOC)
**Verdict:** Multiple critical vulnerabilities. Not safe for production without remediation.

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 14 |
| HIGH | 12 |
| MEDIUM | 8 |
| LOW | 3 |

The application has strong fundamentals in some areas (context isolation, encrypted vault, RLS migrations) but suffers from **critical command injection, arbitrary code execution, missing authentication, and hardcoded secrets** that would allow complete system compromise.

---

## 1. CRITICAL — Arbitrary Shell Command Execution (No Sandboxing)

**Files:**
- `electron/autonomous/pullExecutor.cjs:2596-2604`
- `electron/autonomous/pullExecutor.cjs:3703-3730`

The autonomous execution engine runs **any** shell command with `shell: true` and zero validation:

```javascript
const childProcess = spawn(command, [], {
    shell: true,           // Full shell interpretation
    cwd: cwd || undefined,
    env: env ? { ...process.env, ...env } : process.env
});
```

No allowlists, no denylists, no sandboxing. The AI can execute `rm -rf /`, spawn reverse shells, install malware, or exfiltrate data. Background processes (`system.start_process`) persist after the executor stops.

**Remediation:** Use `spawn()` with argument arrays (no `shell: true`). Implement strict command allowlists. Sandbox execution in containers.

---

## 2. CRITICAL — Arbitrary JavaScript Execution via HTTP (No Auth)

**Files:**
- `electron/autonomous/workspaceApiServer.cjs:418-425` — `/workspace/execute-script`
- `electron/testing/testingApiServer.cjs:515-539` — `/execute-js`

Two unauthenticated HTTP endpoints accept and execute arbitrary JavaScript:

```javascript
// workspaceApiServer.cjs
if (pathname === '/workspace/execute-script' && req.method === 'POST') {
    const result = await workspaceManager.executeScript(body.script); // NO VALIDATION
}

// testingApiServer.cjs
if (pathname === '/execute-js' && req.method === 'POST') {
    const result = await mainWindow.webContents.executeJavaScript(code); // NO VALIDATION
}
```

Any process on localhost can POST to these endpoints and execute JS in the Electron renderer (access localStorage, credentials, cookies, full DOM).

**Remediation:** Remove these endpoints or add token-based authentication. Never execute arbitrary JS from HTTP input.

---

## 3. CRITICAL — Command Injection in shell.openExternal

**File:** `electron/main/main.cjs:901, 905`

```javascript
shell.openExternal(`powershell.exe -Command "${command}"`);   // Windows
shell.openExternal(`x-terminal-emulator -e "${command}"`);     // Linux
```

User-supplied `command` is interpolated directly into shell strings. Payload: `"; rm -rf /; echo "` breaks out trivially.

**Remediation:** Use `child_process.execFile()` with argument arrays. Never interpolate user input into shell strings.

---

## 4. CRITICAL — Command Injection in File Search Operations

**File:** `electron/autonomous/localExecutor.cjs:678-732`

Multiple shell commands built with string interpolation from user-controlled `query` and `name_pattern`:

```javascript
command = `grep -rl "${query}" "${searchDir}" 2>/dev/null | head -n ${limit}`;
command = `find "${searchDir}" -type f -name "*${name_pattern}*"`;
```

**Remediation:** Use `spawn()` with argument arrays. Never pass user input through shell interpolation.

---

## 5. CRITICAL — SQL Injection via sqlite3 CLI

**File:** `electron/autonomous/macosAppleScript.cjs:2208, 2282, 1716-1720`

SQL queries are built with string interpolation and passed to the `sqlite3` command-line tool:

```javascript
const query = `SELECT ZTITLE FROM ZREMCDREMINDER WHERE ZCOMPLETED = 0 ... LIMIT ${limit + 5};`;
const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`);
```

`limit` is user-controlled. This enables both SQL injection AND command injection (double vulnerability).

**Remediation:** Use parameterized queries via the `better-sqlite3` Node library. Never pipe SQL through shell.

---

## 6. CRITICAL — Code Injection via executeJavaScript Template Literals

**File:** `electron/autonomous/workspaceApiServer.cjs:502-533`

```javascript
const credentials = await mainWindow.webContents.executeJavaScript(`
    (async () => {
        return await getCredentialsForService('${service.replace(/'/g, "\\'")}');
    })()
`);
```

Simple quote escaping is trivially bypassable. Attacker injects: `'); return process.exit(0); //` to execute arbitrary code in Electron's **main process context** with full system access.

**Remediation:** Use IPC message passing instead of `executeJavaScript()` with string interpolation.

---

## 7. CRITICAL — Credentials API Without Authentication

**File:** `electron/autonomous/workspaceApiServer.cjs:470-539`

Three HTTP endpoints expose stored credentials with **zero authentication**:

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/credentials/list` | GET | All credential summaries |
| `/credentials/get-for-service` | POST | Credentials for a service |
| `/credentials/get-decrypted` | POST | Decrypted credential plaintext |

Any process on localhost can read all stored API keys, passwords, and tokens.

**Remediation:** Add token-based authentication. Remove decrypted credential endpoints entirely.

---

## 8. CRITICAL — Web Security Disabled on All Windows

**File:** `electron/main/main.cjs:220, 367, 628`

```javascript
webSecurity: false,  // On mainWindow, cardWindow, AND settingsWindow
```

This disables the same-origin policy across the entire application, allowing arbitrary cross-origin requests from the renderer.

**Remediation:** Set `webSecurity: true` on all BrowserWindow instances.

---

## 9. CRITICAL — CSP Defeated by 'unsafe-inline'

**File:** `electron/main/main.cjs:303-315, 661-672`

```
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' http://localhost:5173 https://js.stripe.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
```

`unsafe-inline` completely negates CSP protection. Combined with `webSecurity: false`, this means there are effectively **no browser-level security boundaries**.

**Remediation:** Remove `unsafe-inline`. Use nonce-based or hash-based CSP. Remove `localhost:5173` from production builds.

---

## 10. CRITICAL — Hardcoded Production API Keys

**Files:**
- `src/services/supabase.js:14-15` — Supabase anon key (JWT valid until 2076)
- `test-network-stability.js:11` — Production API key
- `scripts/test_browser_tool.cjs:8` — Production API key
- `.env.example:34-35` — Real Supabase credentials

```javascript
const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
const API_KEY = process.env.VITE_API_KEY || 'e341a4acb41aa9c80b4baba442b0a24e8d1ce9fa7b4e5307ed34ef2aa15258f0';
```

These are committed to git history and cannot be removed without rotation.

**Remediation:** Rotate all exposed keys immediately. Remove hardcoded fallbacks. Use `.env.example` with placeholder values only.

---

## 11. CRITICAL — Unrestricted File System Access

**File:** `electron/autonomous/pullExecutor.cjs:2934-3050`

File write operations accept **any path** with no traversal protection:

```javascript
const filePath = args.filename || args.path || args.file_path;
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(filePath, content, 'utf8');  // ANY PATH
```

The AI can write to `/etc/passwd`, `~/.ssh/authorized_keys`, or any other system file. `localExecutor.cjs` has path validation but uses `path.resolve()` instead of `fs.realpathSync()`, making it vulnerable to symlink attacks.

**Remediation:** Implement strict directory allowlists. Use `fs.realpathSync()` to resolve symlinks before access checks.

---

## 12. HIGH — Unvalidated URLs in shell.openExternal

**File:** `electron/main/main.cjs:321-324, 378-381`

```javascript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);  // NO URL VALIDATION
    return { action: 'deny' };
});
```

URLs from renderer `window.open()` calls pass directly to `shell.openExternal()` without protocol validation. Could trigger `javascript:`, `data:`, or custom protocol handlers.

Note: The separate `open-external` IPC handler (line 934) *does* validate protocols — this one doesn't.

**Remediation:** Validate URL protocol (allow only `https:`, `http:`, `mailto:`) before calling `shell.openExternal()`.

---

## 13. HIGH — Unsafe innerHTML in Notes Application

**File:** `electron/notes/notes.html:1037, 1055`

```javascript
elements.folderList.innerHTML = html;      // folder.name unescaped
elements.tagsContainer.innerHTML = html;   // tag names unescaped
```

Folder names and tags from IPC are rendered as HTML without escaping. Other locations in the same file (lines 1341, 1361) properly use `escapeHtml()` — these were missed.

**Remediation:** Use `escapeHtml()` consistently for all user-supplied content rendered via innerHTML.

---

## 14. HIGH — Weak OAuth State Validation

**File:** `src/services/oauth.js:38-59`

```javascript
// "In a real app, you'd want to use a proper hashing library"
let hash = 0;
for (let i = 0; i < state.length; i++) {
    const char = state.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
}
return Math.abs(hash).toString(16);
```

Simple string hashing instead of SHA-256 for CSRF token validation. Vulnerable to collision attacks. The code's own comment acknowledges it's not production-ready.

**Remediation:** Use `crypto.subtle.digest('SHA-256', ...)` for state hashing.

---

## 15. HIGH — Encryption Key Stored in localStorage

**File:** `src/services/credentialsManager.js:49`

```javascript
localStorage.setItem('_credentials_key', keyBase64);
```

The AES-256-GCM encryption key for all stored credentials is in localStorage — accessible to any XSS attack. Combined with CSP bypass (unsafe-inline) and webSecurity:false, this is trivially exploitable.

**Also affected:** `src/services/secureStorage.js:58, 86` — API keys fallback to localStorage when keytar is unavailable.

**Remediation:** Store encryption keys in OS keychain (keytar) only. Never fall back to localStorage for secrets.

---

## 16. HIGH — Weak Encryption Key Derivation

**File:** `electron/main/main.cjs:~2380`

```javascript
const key = cryptoModule.scryptSync(app.getPath('userData'), 'salt', 32);
```

Hardcoded `'salt'` string (not random). Input is predictable (`app.getPath('userData')`). Default scrypt N=16384 is low for modern systems.

**Remediation:** Use random salt stored alongside ciphertext. Increase scrypt N to 65536+.

---

## 17. HIGH — CORS Wildcard on All Local API Servers

**Files:**
- `electron/autonomous/workspaceApiServer.cjs:53-55`
- `electron/spreadsheet/spreadsheetApiServer.cjs:53-55`
- `electron/notes/notesApiServer.cjs:42-44`
- `electron/testing/testingApiServer.cjs:59-61`

```javascript
'Access-Control-Allow-Origin': '*'
```

All four local HTTP servers (ports 3847-3850) allow requests from any origin. Any website the user visits could interact with these APIs.

**Remediation:** Remove wildcard CORS. Use specific allowed origins or localhost-only with token auth.

---

## 18. HIGH — Error Stack Traces Sent to Analytics

**File:** `electron/analytics/posthog-main.cjs:153-167`

```javascript
function captureError(error, context = {}) {
    const errorData = {
        error_stack: error.stack,  // Full stack trace to PostHog
        ...context,
    };
    capture('error_occurred', errorData);
}
```

Stack traces may contain file paths, credentials in error messages, database details, and system information.

**Also:** Tool execution args and stdout/stderr are sent to analytics (lines 276-298), potentially leaking passwords, API keys, and PII.

**Remediation:** Sanitize error data before sending to analytics. Never send raw stack traces or tool output.

---

## 19. HIGH — Device Token in URL Query Parameters

**File:** `electron/integrations/hands-on-desktop-client.cjs:103`

```javascript
const url = `${this.backendUrl}/api/v2/autonomous/stream?device_token=${this.deviceToken}`;
```

Device tokens in URLs are logged in server logs, browser history, proxy logs, and CDN caches.

**Remediation:** Use `Authorization: Bearer` header instead of query parameters.

---

## 20. HIGH — AppleScript Injection

**Files:**
- `electron/main/main.cjs:886-892` — Terminal command injection
- `electron/autonomous/macosAppleScript.cjs:385, 596` — URL injection
- `electron/autonomous/localExecutor.cjs:800-802` — Script injection

URLs and commands are interpolated into AppleScript strings with insufficient escaping. Payload: `" & do shell script "rm -rf ~" & "` breaks out of the string context.

**Remediation:** Use proper AppleScript quoting. Pass data via environment variables or temp files instead of string interpolation.

---

## 21. HIGH — Environment Variable Injection

**File:** `electron/autonomous/pullExecutor.cjs:2598`

```javascript
env: env ? { ...process.env, ...env } : process.env
```

User-controlled `env` object is merged with `process.env`. Attacker can set `LD_PRELOAD`, `PATH`, `HOME`, `NODE_OPTIONS`, etc. to hijack process behavior.

**Remediation:** Allowlist permitted environment variables. Never merge untrusted input with process.env.

---

## 22. MEDIUM — Missing will-navigate Handler

**File:** `electron/main/main.cjs`

No `will-navigate` event handler is registered on any BrowserWindow. The application cannot prevent or detect navigation to phishing pages or malicious URLs.

**Remediation:** Add `will-navigate` handler that validates navigation targets against an allowlist.

---

## 23. MEDIUM — dangerouslySetInnerHTML in React

**File:** `src/components/DraftPreview.jsx`

```javascript
dangerouslySetInnerHTML={is_html ? { __html: body } : undefined}
```

If `body` contains untrusted HTML content, this enables XSS. Given that credentials are stored in localStorage (accessible to XSS), this is an escalation vector.

**Remediation:** Sanitize HTML with DOMPurify before rendering.

---

## 24. MEDIUM — PII Redaction Incomplete

**File:** `src/services/supabaseMemory.js:669`

```javascript
redactedContent: content, // TODO: Add PII redaction
```

PII redaction is planned but not implemented. User messages may contain sensitive personal information that gets stored unredacted in the cloud database.

**Remediation:** Implement PII detection and redaction before cloud storage.

---

## 25. MEDIUM — Incomplete Rate Limiting

Only vault IPC handlers implement rate limiting (`electron/memory/vault-ipc-handlers-secure.cjs:28-53`). All HTTP API servers, main IPC handlers, and API calls lack rate limiting, enabling abuse and DoS.

**Remediation:** Add rate limiting to all API servers and sensitive IPC handlers.

---

## 26. MEDIUM — Symlink Path Traversal in localExecutor

**File:** `electron/autonomous/localExecutor.cjs:479-511`

```javascript
const resolved = path.resolve(filePath);  // Does NOT resolve symlinks
if (!(resolved.startsWith(safeRoot))) { throw new Error('Access denied'); }
return resolved;  // Symlink to /etc/passwd passes this check
```

Uses `path.resolve()` instead of `fs.realpathSync()`. Symlinks within the home directory can point to any system file.

**Remediation:** Use `fs.realpathSync()` to resolve symlinks before path validation.

---

## 27. MEDIUM — Console Logging of Credential Operations

**File:** `src/services/credentialsManager.js:190, 218, 230, 291`

Credential operations (add, update, delete, import) are logged to console with service names. While secrets aren't logged directly, the metadata aids targeted attacks.

**Remediation:** Remove credential operation logging or restrict to development builds only.

---

## 28. MEDIUM — Supabase Session in localStorage

**File:** `src/services/supabase.js:235-239`

`persistSession: true` stores Supabase auth sessions in localStorage, accessible to XSS.

**Remediation:** In Electron context, use secure storage for session persistence instead of localStorage.

---

## Dependency Vulnerabilities (npm audit)

| Package | Severity | Issue |
|---------|----------|-------|
| electron <35.7.5 | Moderate | ASAR integrity bypass |
| esbuild <=0.24.2 | Moderate | Dev server CORS bypass |
| form-data <2.5.4 | Critical | Unsafe random for boundary |
| glob 10.2-10.4.5 | High | Command injection via --cmd |
| jpeg-js <=0.4.3 | High | Infinite loop / resource exhaustion |
| js-yaml <3.14.2 | Moderate | Prototype pollution in merge |
| lodash 4.x | Moderate | Prototype pollution in unset/omit |
| lodash-es 4.x | Moderate | Prototype pollution in unset/omit |

**Remediation:** Run `npm audit fix`. Upgrade electron to >=35.7.5. Replace deprecated `request` package.

---

## Positive Security Findings

The following are implemented correctly:

- **contextIsolation: true** on all BrowserWindow instances
- **nodeIntegration: false** on all windows
- **sandbox: true** on all windows
- **Memory vault encryption** — AES-256-CBC with keys in OS keychain
- **Vault keychain** — PBKDF2 with 100,000 iterations for key backup
- **Supabase RLS** — Row-level security with active migration fixes
- **HMAC verification** — Message integrity checking exists
- **IPC validation framework** — IPCValidator utility exists (though not used everywhere)
- **DevTools restricted** to development builds
- **HTTPS enforcement** — No insecure HTTP API calls found
- **Certificate validation** — No `rejectUnauthorized: false` found
- **.gitignore** properly excludes `.env` files

---

## Risk Matrix

```
                        Low Impact    Medium Impact    High Impact    Critical Impact
                       ┌─────────────┬───────────────┬──────────────┬────────────────┐
  Easy to Exploit      │             │ #25 Rate Limit│ #17 CORS *   │ #7 Creds API   │
                       │             │               │ #18 Stack TX │ #2 JS Exec     │
                       │             │               │ #19 Token URL│ #10 API Keys   │
                       ├─────────────┼───────────────┼──────────────┼────────────────┤
  Moderate to Exploit  │ #27 Logging │ #22 Navigate  │ #13 innerHTML│ #1 Shell Exec  │
                       │             │ #24 PII       │ #14 OAuth    │ #3 Cmd Inject  │
                       │             │ #28 Session   │ #15 Key LS   │ #4 Search Inj  │
                       │             │               │ #16 Weak KDF │ #6 executeJS   │
                       ├─────────────┼───────────────┼──────────────┼────────────────┤
  Hard to Exploit      │             │ #26 Symlink   │ #20 AppleSc  │ #5 SQL Inject  │
                       │             │ #23 XSS React │ #21 Env Inj  │ #8 webSecurity │
                       │             │               │ #12 URL Open │ #9 CSP         │
                       │             │               │              │ #11 File Write │
                       └─────────────┴───────────────┴──────────────┴────────────────┘
```

---

## Recommended Remediation Priority

### Immediate (This Week)
1. Rotate all hardcoded API keys (#10)
2. Add authentication to HTTP API servers (#7, #2)
3. Enable `webSecurity: true` (#8)
4. Remove `/execute-js` endpoint (#2)

### Urgent (This Sprint)
5. Replace `shell: true` with argument arrays (#1, #4)
6. Fix command injection in `shell.openExternal` (#3)
7. Use IPC instead of `executeJavaScript` with interpolation (#6)
8. Implement command allowlists for autonomous execution (#1)
9. Add path validation/sandboxing for file operations (#11)

### Short-Term (This Month)
10. Fix CSP — remove `unsafe-inline`, use nonces (#9)
11. Move credentials encryption key to OS keychain (#15)
12. Implement proper OAuth state hashing (#14)
13. Add URL validation to `setWindowOpenHandler` (#12)
14. Sanitize analytics data (#18)
15. Fix SQL injection — use parameterized queries (#5)

### Medium-Term (Next Quarter)
16. Add rate limiting across all APIs (#25)
17. Implement PII redaction (#24)
18. Add `will-navigate` handler (#22)
19. Sanitize HTML in React components (#23)
20. Upgrade vulnerable dependencies
