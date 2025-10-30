# Better Memory Integration Patch for AppleFloatBar.jsx

This document shows exactly what to add to integrate the Better Memory system into the chat flow.

## Step 1: Add Imports

**At the top of AppleFloatBar.jsx (around line 12):**

```javascript
// ADD THESE IMPORTS:
import memoryAPI from '../../services/memoryAPI';
import ContextPreview from './ContextPreview';
```

## Step 2: Add State Variables

**In the component state section (around line 43):**

```javascript
// ADD THESE STATE VARIABLES:
const [contextPack, setContextPack] = useState(null);
const [showContextPreview, setShowContextPreview] = useState(false);
const [isLoadingContext, setIsLoadingContext] = useState(false);
const [contextPreviewExpanded, setContextPreviewExpanded] = useState(false);
```

## Step 3: Add Context Retrieval Function

**Add this new function before `continueSend` (around line 200):**

```javascript
/**
 * Retrieve memory context for the user's message.
 * Returns a context pack with facts, semantic hits, and recent messages.
 */
const retrieveContext = useCallback(async (text) => {
  setIsLoadingContext(true);
  try {
    const pack = await memoryAPI.query({
      text: text,
      k_facts: 8,
      k_sem: 6,
      token_budget: 900,
      allow_vectors: false
    });
    
    setContextPack(pack);
    setShowContextPreview(true);
    setContextPreviewExpanded(true); // Auto-expand on first load
    
    logger.info('[Memory] Retrieved context pack:', {
      facts: pack.facts.length,
      semantic_hits: pack.semantic_hits.length,
      messages: pack.recent_messages.length,
      tokens: `${pack.budget.used_tokens}/${pack.budget.cap}`
    });
    
    return pack;
  } catch (error) {
    logger.error('[Memory] Failed to retrieve context:', error);
    toast.error('Failed to load memory context');
    return null;
  } finally {
    setIsLoadingContext(false);
  }
}, []);
```

## Step 4: Modify `continueSend` Function

**REPLACE the userContext building section (lines 313-354) with this:**

```javascript
    // === BETTER MEMORY INTEGRATION ===
    // Build enhanced user context with Better Memory system
    let userContext = {
      recent_messages: thoughts.map(t => ({ role: t.role, content: t.content })),
      profile: null,
      facts: null,
      preferences: null,
      google_user_email: localStorage.getItem('google_user_email') || null
    };
    
    // Get context pack from Better Memory (if available)
    if (contextPack) {
      // Use the pre-retrieved context pack
      userContext.memory_pack = {
        facts: contextPack.facts.map(f => ({
          category: f.category,
          key: f.key,
          value: f.value,
          confidence: f.confidence
        })),
        semantic_hits: contextPack.semantic_hits.map(h => ({
          snippet: h.snippet,
          score: h.score
        })),
        rationale: contextPack.rationale,
        token_budget: contextPack.budget
      };
      
      logger.info('[Memory] Using context pack in prompt:', {
        facts: contextPack.facts.length,
        semantic_hits: contextPack.semantic_hits.length,
        tokens: contextPack.budget.used_tokens
      });
    }
    
    // Legacy memory system (fallback)
    if (window.electron?.memory) {
      try {
        const [profile, facts, preferences] = await Promise.all([
          window.electron.memory.getProfile().catch(() => null),
          window.electron.memory.getFacts().catch(() => null),
          window.electron.memory.getPreferences().catch(() => null)
        ]);
        userContext.profile = profile;
        userContext.facts = facts;
        userContext.preferences = preferences;
      } catch (error) {
        console.warn('[Chat] Failed to load legacy memory context:', error);
      }
    }
    
    // Clear context pack after use
    setContextPack(null);
    setShowContextPreview(false);
```

## Step 5: Add Context Retrieval Trigger

**REPLACE the `handleSend` function (look for existing handleSend) with this:**

```javascript
  const handleSend = useCallback(async () => {
    if (!message.trim()) return;
    if (isThinking) return;
    if (!apiConnected && !offlineRef.current) {
      toast.error('No API connection. Please check your network.');
      return;
    }

    const text = message.trim();
    lastUserPromptRef.current = text;

    // Step 1: Retrieve memory context first
    setIsLoadingContext(true);
    const pack = await retrieveContext(text);
    setIsLoadingContext(false);
    
    // Context preview is now showing
    // User can review and toggle items
    // When they're ready, they'll click send again or we auto-send after delay
    
    if (autoSend) {
      // Auto-send after short delay to let user see context
      setTimeout(() => {
        continueSend(text);
      }, 1000);
    }
    // Otherwise user must click send again after reviewing context
  }, [message, isThinking, apiConnected, retrieveContext, continueSend, autoSend]);
```

## Step 6: Add Context Preview to JSX

**In the render section, BEFORE the input area (around line 500), add:**

```jsx
        {/* Context Preview */}
        {showContextPreview && contextPack && (
          <ContextPreview
            pack={contextPack}
            onToggle={(controls) => {
              // Handle toggle changes
              logger.info('[Memory] Context controls changed:', controls);
              // Could filter pack based on controls here
            }}
            isExpanded={contextPreviewExpanded}
            onToggleExpand={() => setContextPreviewExpanded(!contextPreviewExpanded)}
          />
        )}
        
        {/* Loading indicator while retrieving context */}
        {isLoadingContext && (
          <div className="context-loading">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading context...</span>
          </div>
        )}
```

## Step 7: Save Messages to Memory

**After a successful message send, add this (around line 460-470 in the SSE handler):**

```javascript
      } else if (event.type === 'done') {
        // Stream complete
        setIsThinking(false);
        setThinkingStatus('');
        enrichTileIdRef.current = null;
        
        // === SAVE TO BETTER MEMORY ===
        // Save both user and assistant messages
        if (window.electron?.memory) {
          // Save user message
          memoryAPI.saveMessage({
            role: 'user',
            content: lastUserPromptRef.current,
            session_id: null // Could track session here
          }).catch(err => {
            logger.warn('[Memory] Failed to save user message:', err);
          });
          
          // Save assistant message
          if (streamBufferRef.current) {
            memoryAPI.saveMessage({
              role: 'assistant',
              content: streamBufferRef.current,
              session_id: null
            }).catch(err => {
              logger.warn('[Memory] Failed to save assistant message:', err);
            });
          }
        }
        
        // Mark streaming as complete
        setThoughts(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant' && last.streaming) {
            updated[updated.length - 1] = {
              ...last,
              streaming: false
            };
          }
          return updated;
        });
```

## Step 8: Add CSS for Loading Indicator

**Add to AppleFloatBar.css:**

```css
.context-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(33, 150, 243, 0.08);
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #2196F3;
}

.context-loading svg {
  color: #2196F3;
}
```

---

## Testing the Integration

1. **Start the backend:**
   ```bash
   cd Agent_Max
   uvicorn api.main:app --reload
   ```

2. **Start the frontend:**
   ```bash
   cd agent-max-desktop
   npm start
   ```

3. **Test the flow:**
   - Type a message: "What food do I like?"
   - Watch the context preview appear
   - See facts, semantic hits, and recent messages
   - Message auto-sends after 1 second
   - Response includes context-aware information

4. **Verify in database:**
   ```bash
   sqlite3 ~/.agent_max/memory.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;"
   ```

---

## Expected Behavior

### Before Sending:
1. User types message
2. Context retrieval triggers (1-2 second)
3. Context Preview appears with:
   - Facts (with confidence, pinned badges)
   - Semantic hits (related conversation)
   - Recent messages (collapsible)
   - Token meter showing usage
4. User can toggle items on/off
5. Auto-sends after delay (or manual send)

### During Response:
- Context pack is included in API call
- AI has access to relevant memory
- Streaming response appears
- Fact tiles render for tool results

### After Response:
- Both messages saved to database
- Available for future retrievals
- Context preview closes

---

## Troubleshooting

**Context preview doesn't appear:**
- Check browser console for errors
- Verify API is running on localhost:8000
- Check `/api/memory/health` endpoint

**No facts retrieved:**
- Database is empty (add some facts first)
- Try: `curl -X POST http://localhost:8000/api/memory/facts -H "Content-Type: application/json" -d '{"category":"test","key":"test","value":"test"}'`

**Token meter shows 0:**
- Check if pack is null
- Verify memory API response structure

**Auto-send doesn't work:**
- Check `autoSend` prop is true
- Verify setTimeout is executing
- Check console for errors

---

## Next Steps

Once this integration is working:
1. **Phase 2:** Add extraction (Memory Toast for proposals)
2. **Phase 2:** Add Memory Inspector (Cmd+M)
3. **Phase 3:** Add Supabase sync (multi-device)

This completes Phase 1 frontend integration! 🎉
