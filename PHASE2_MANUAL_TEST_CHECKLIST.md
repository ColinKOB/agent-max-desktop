# Phase 2 Manual Test Checklist

**Date**: October 22, 2025  
**Feature**: Deterministic Tools (Fact Tiles)  
**Tester**: _______________

---

## Prerequisites

- [ ] Backend API running on `http://localhost:8000`
- [ ] `curl http://localhost:8000/health` returns `{"status":"healthy"}`
- [ ] agent-max-desktop dev server running (`npm run dev`)

---

## Test 1: Time Tool

**Query**: "What time is it?"

### Expected Behavior
- [ ] Fact tile appears within 100ms (instant, no spinner)
- [ ] Title: "Current Time"
- [ ] Primary text shows: "[TIME] [DAY], [DATE]" (e.g., "10:38 AM Wednesday, October 22, 2025")
- [ ] Meta shows: "⚡ [0-5] ms" and "✓ conf 100%"
- [ ] Tile has glass morphism effect (blur, semi-transparent background)
- [ ] Slide-in animation is smooth (300ms)

### Verification
- [ ] Browser console shows: `[Chat] Received SSE event: {type: "tool_result", tool_name: "time"}`
- [ ] Logger shows: `[FactTile] Rendered time tile in [X]ms`

---

## Test 2: Math Tool

**Query**: "2 + 2"

### Expected Behavior
- [ ] Fact tile appears instantly
- [ ] Title: "Calculation"
- [ ] Primary text: "2 + 2 = 4"
- [ ] Meta shows latency < 10ms
- [ ] Tile stacks above previous time tile (if not cleared)

### Additional Math Tests
- [ ] "5 * 8" → "5 * 8 = 40"
- [ ] "100 / 4" → "100 / 4 = 25"
- [ ] "(5 + 3) * 2" → "(5 + 3) * 2 = 16"

---

## Test 3: Unit Conversion Tool

**Query**: "100 km to miles"

### Expected Behavior
- [ ] Fact tile appears
- [ ] Title: "Conversion"
- [ ] Primary text: "100 km = 62.1371 mi" (or similar)
- [ ] Meta shows confidence ~99%

### Additional Conversion Tests
- [ ] "32 fahrenheit to celsius" → "32 °F = 0 °C"
- [ ] "10 kg to pounds" → "10 kg = 22.0462 lb"

---

## Test 4: Date Tool

**Query**: "What's the date?"

### Expected Behavior
- [ ] Fact tile appears
- [ ] Title: "Today"
- [ ] Primary text: "[DAY], [DATE]" (e.g., "Wednesday, October 22, 2025")

---

## Test 5: Non-Tool Queries (Fallback)

**Query**: "What's the best time to call?"

### Expected Behavior
- [ ] NO fact tile appears
- [ ] Normal chat response (progressive or accurate lane)
- [ ] Console shows routing to `progressive_context` or `accurate` lane

### Additional Fallback Tests
- [ ] "Time for bed?" → No tile, chat response
- [ ] "Calculate my mortgage" → No tile, chat response
- [ ] "What is the meaning of life?" → No tile, chat response

---

## Test 6: Multiple Tiles Stacking

**Steps**:
1. Type: "What time is it?" → Press Enter
2. Type: "2 + 2" → Press Enter
3. Type: "100 km to miles" → Press Enter

### Expected Behavior
- [ ] Three tiles visible, stacked vertically
- [ ] Newest tile at top (conversion)
- [ ] Proper spacing (8px gap between tiles)
- [ ] All tiles have glass morphism effect
- [ ] Scrollable if content exceeds window height

---

## Test 7: Clear Conversation

**Steps**:
1. Create 2-3 fact tiles (any queries)
2. Click the clear button (RotateCcw icon in toolbar)

### Expected Behavior
- [ ] All fact tiles removed
- [ ] Toast notification: "Conversation cleared"
- [ ] Messages also cleared

---

## Test 8: Hover Effects

**Steps**:
1. Create a fact tile
2. Hover mouse over the tile

### Expected Behavior
- [ ] Background becomes slightly brighter
- [ ] Border becomes more visible
- [ ] Tile elevates slightly (translateY(-1px))
- [ ] Shadow becomes more prominent
- [ ] Transition is smooth (200ms)

---

## Test 9: Window Resizing

**Steps**:
1. Start with collapsed FloatBar
2. Expand FloatBar
3. Add 2-3 fact tiles

### Expected Behavior
- [ ] Window height adjusts to accommodate tiles
- [ ] Content remains visible (no clipping)
- [ ] Scrollbar appears if content exceeds max height
- [ ] Collapse/expand works with tiles present

---

## Test 10: Enrichment Streaming (Optional)

**Note**: Only if backend emits enrichment tokens

**Steps**:
1. Send a tool query that supports enrichment
2. Watch for streaming tokens after tool_result

### Expected Behavior
- [ ] Enrichment section appears below tile (with border separator)
- [ ] Text streams word-by-word
- [ ] Fade-in animation (400ms)
- [ ] Enrichment text is readable (opacity 0.9)

---

## Visual Quality Checks

### Glass Morphism
- [ ] Blur effect visible (16px)
- [ ] Semi-transparent background (rgba(255,255,255,0.08))
- [ ] Border visible but subtle (rgba(255,255,255,0.12))
- [ ] Shadow provides depth (0 8px 30px rgba(0,0,0,0.25))

### Typography
- [ ] Header is uppercase, small (11px), subtle opacity
- [ ] Primary text is large (18px), high contrast
- [ ] Meta text is small (11px), lower opacity
- [ ] Text shadow makes text crisp

### Animations
- [ ] Slide-in is smooth (300ms cubic-bezier)
- [ ] No jank or stuttering
- [ ] Enrichment fade-in is smooth

---

## Performance Checks

### TTFT (Time to First Tile)
- [ ] Time tool: < 50ms
- [ ] Math tool: < 50ms
- [ ] Unit conversion: < 50ms

### Console Logs
- [ ] No errors in browser console
- [ ] SSE events logged correctly
- [ ] FactTile render logs show sub-5ms render times

### Network
- [ ] Single SSE request per query
- [ ] No failed requests (check Network tab)
- [ ] `tool_result` event received before `[DONE]`

---

## Edge Cases

### Empty State
- [ ] No tiles on first load (FactTileList returns null)
- [ ] No visual artifacts when tiles array is empty

### Rapid Queries
**Steps**: Send 5 queries rapidly (2 + 2, 5 * 8, 10 - 3, etc.)

- [ ] All tiles render correctly
- [ ] No missing tiles
- [ ] No duplicate tiles
- [ ] Correct stacking order (newest first)

### Long Primary Text
**Query**: Enter a long math expression (e.g., "(100 + 200) * 3 / 4 - 50")

- [ ] Text wraps properly (line-height: 1.3)
- [ ] Tile expands vertically to fit content
- [ ] No text overflow

---

## Browser Compatibility

Test in multiple browsers (if possible):

### Chrome/Edge
- [ ] Glass morphism renders correctly
- [ ] Animations smooth
- [ ] No console errors

### Safari
- [ ] Backdrop blur works (Safari 9+)
- [ ] Colors render correctly
- [ ] Performance acceptable

### Firefox
- [ ] Backdrop filter supported (Firefox 103+)
- [ ] Layout correct
- [ ] No rendering issues

---

## Acceptance Criteria

### Must Pass (Critical)
- [ ] All tool queries trigger fact tiles correctly
- [ ] Non-tool queries fall back to chat
- [ ] Glass morphism styling matches design
- [ ] TTFT < 100ms for all tools
- [ ] Clear button removes tiles
- [ ] No console errors

### Should Pass (Important)
- [ ] Hover effects work
- [ ] Animations smooth
- [ ] Window resizing works
- [ ] Multiple tiles stack correctly

### Nice to Have
- [ ] Enrichment streaming works (if implemented)
- [ ] Performance metrics logged
- [ ] Dark theme support

---

## Sign-off

**Test Date**: _______________  
**Tester Name**: _______________  
**Result**: ☐ PASS  ☐ FAIL  
**Notes**:

_____________________________________________
_____________________________________________
_____________________________________________

---

## Troubleshooting

### Issue: Tiles not appearing

1. Check backend: `curl http://localhost:8000/api/v2/chat/streaming/stream -X POST -H 'Content-Type: application/json' -H 'X-API-Key: dev' -d '{"message":"What time is it?"}'`
2. Expected output: `data: {"type": "tool_result", ...}`
3. If no output, check backend logs
4. If output correct, check browser console for SSE event reception

### Issue: Styling broken

1. Check browser console for CSS loading errors
2. Verify `FactTile.css` exists in `src/components/`
3. Check browser supports backdrop-filter (caniuse.com)
4. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

### Issue: TypeScript errors

1. Check `FactTile.tsx` and `FactTileList.tsx` are valid TypeScript
2. Run `npm run type-check` (if available)
3. Check import statement in `AppleFloatBar.jsx` line 15-16

### Issue: Window not resizing

1. Check `updateWindowHeight()` function in AppleFloatBar
2. Verify `factTiles` state triggers useEffect on line 443
3. Check Electron IPC handlers for window resizing

---

**END OF CHECKLIST**
