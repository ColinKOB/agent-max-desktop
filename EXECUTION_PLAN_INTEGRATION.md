# Execution Plan & Thinking Stream Integration Guide

## What's New

1. **Upfront Planning**: AI generates complete execution plan before starting
2. **Plan Display**: User sees all steps that will be executed
3. **Enhanced Thinking**: Shows AI's reasoning and progress
4. **Live Progress**: Visual indication of current step

## Backend Changes (✅ Complete)

- Added `_generate_plan()` method to generate upfront plans
- Emits `plan` event with all steps before execution
- Enhanced `thinking` events with step context
- Uses `gpt-5-mini` for fast planning

## Frontend Integration

### Step 1: Add State to AppleFloatBar.jsx

```jsx
import ExecutionPlan from '../ExecutionPlan';

function AppleFloatBar() {
  // ... existing state ...
  
  // NEW: Plan state
  const [executionPlan, setExecutionPlan] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  // ... rest of component ...
}
```

### Step 2: Handle Plan Event

```jsx
// In the sendChat or handleSubmit function where you handle SSE events

const handleEvent = (event) => {
  const eventType = event.type;
  
  // NEW: Handle plan event
  if (eventType === 'plan') {
    setExecutionPlan(event.data);
    setCurrentStep(0);  // Reset to show plan
    return;
  }
  
  // NEW: Handle enhanced thinking
  if (eventType === 'thinking') {
    const step = event.data.step;
    if (step) {
      setCurrentStep(step);  // Update current step for progress
    }
    
    // Add to thoughts as usual
    setThinkingStatus(event.data.message || 'Thinking...');
    return;
  }
  
  // ... handle other events ...
};
```

### Step 3: Render Execution Plan

```jsx
// In the render section of AppleFloatBar, add the plan display

{/* Execution Plan (shows when available) */}
{executionPlan && (
  <ExecutionPlan
    plan={executionPlan}
    currentStep={currentStep}
    onApprove={() => {
      // Optional: Add approval flow
      // For now, auto-approve
      setExecutionPlan(null);
    }}
    onCancel={() => {
      // Cancel execution
      setExecutionPlan(null);
      setIsThinking(false);
    }}
  />
)}

{/* Messages (existing) */}
<div className="apple-messages" ref={messagesRef}>
  {/* ... existing message rendering ... */}
</div>
```

### Step 4: Enhanced Thinking Display

```jsx
// Update the thinking indicator to show enhanced details

{isThinking && (
  <div className="apple-message apple-message-thinking">
    <div className="typing-indicator">
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className="typing-text">{thinkingStatus || 'Thinking...'}</span>
      
      {/* NEW: Show step progress */}
      {currentStep > 0 && executionPlan && (
        <span style={{ 
          fontSize: '0.75rem', 
          color: 'rgba(255,255,255,0.6)' 
        }}>
          Step {currentStep} of {executionPlan.total_steps}
        </span>
      )}
    </div>
  </div>
)}
```

## Testing

### 1. Start the Backend (with new changes)

```bash
cd Agent_Max
python -m uvicorn api.main:app --reload
```

### 2. Start the Desktop App

```bash
cd agent-max-desktop
npm run electron:dev
```

### 3. Test with Todo App Prompt

1. Select **Autonomous** mode (wrench icon → Autonomous)
2. Send: `"create a todo app in the desktop folder"`
3. You should see:
   - 🧠 "Analyzing task and generating execution plan..."
   - 📋 Execution plan with all steps
   - Progress indicators as each step executes
   - ✅ Completion with summary

### Expected Output

```
🧠 Analyzing task and generating execution plan...

📋 Execution Plan

💭 Creating a web-based todo app requires HTML, CSS, and JavaScript files with localStorage persistence

⏱️ ~12s | 📋 5 steps

○ Step 1: Create project folder ~/Desktop/todo-app
○ Step 2: Create index.html with HTML5 boilerplate
○ Step 3: Create style.css with modern styling
○ Step 4: Create app.js with todo logic
○ Step 5: Verify all files exist

[Proceed] [Cancel]

---

Step 1/5: Create project folder ~/Desktop/todo-app
💭 Need to create parent directory with proper permissions
⚡ Running: mkdir -p ~/Desktop/todo-app
✅ Success (1.2s)

Step 2/5: Create index.html with HTML5 boilerplate
💭 Using semantic HTML5 with mobile viewport
⚡ Running: cat > ~/Desktop/todo-app/index.html <<EOF...
✅ Success (1.8s, 533 bytes)

...
```

## Event Flow

```
User: "create a todo app"
  ↓
1. thinking: "Analyzing task..."
  ↓
2. plan: {steps: [...], total_steps: 5, estimated_time: 12}
  ↓
3. thinking: "Step 1/5: Create project folder"
  ↓
4. step: {step_number: 1, action: "execute_command", result: "..."}
  ↓
5. thinking: "Step 2/5: Create index.html"
  ↓
6. step: {step_number: 2, ...}
  ↓
... (repeat for all steps)
  ↓
7. done: {status: "completed", final_response: "..."}
```

## Optional Enhancements

### 1. Approval Flow

Add a confirmation step before execution:

```jsx
const [awaitingApproval, setAwaitingApproval] = useState(false);

// In plan event handler
if (eventType === 'plan') {
  setExecutionPlan(event.data);
  setAwaitingApproval(true);  // Wait for user
  return;
}

// Approval buttons
onApprove={() => {
  setAwaitingApproval(false);
  // Send approval to backend (if using WebSocket)
  // Or just continue streaming (if using SSE)
}}
```

### 2. Collapsible Plan

Allow user to collapse the plan after approval:

```jsx
const [planCollapsed, setPlanCollapsed] = useState(false);

<ExecutionPlan
  plan={executionPlan}
  currentStep={currentStep}
  collapsed={planCollapsed}
  onToggleCollapse={() => setPlanCollapsed(!planCollapsed)}
/>
```

### 3. Plan Modification (Advanced)

Allow user to edit steps before execution:

```jsx
const [editingPlan, setEditingPlan] = useState(false);

<ExecutionPlan
  plan={executionPlan}
  editable={editingPlan}
  onEdit={(modifiedPlan) => {
    setExecutionPlan(modifiedPlan);
    setEditingPlan(false);
  }}
/>
```

### 4. Progress Animation

Add smooth progress bar:

```jsx
<div className="progress-container">
  <div 
    className="progress-bar"
    style={{
      width: `${(currentStep / executionPlan.total_steps) * 100}%`,
      transition: 'width 0.3s ease'
    }}
  />
</div>
```

## Benefits

### Before
```
User: "create a todo app"
AI: [creates folder]
AI: [does nothing else]
User: "..." (confused)
```

### After
```
User: "create a todo app"
AI: "📋 Plan: 5 steps, ~12s"
    1. Create folder ○
    2. Create HTML ○
    3. Create CSS ○
    4. Create JS ○
    5. Verify ○
User: [Proceed]
AI: ✓ Step 1 complete
AI: ✓ Step 2 complete
...
AI: ✅ All done! Created 3 files (1,202 bytes)
```

## Troubleshooting

### Plan not showing

1. Check console for `plan` event
2. Verify mode is "autonomous"
3. Check backend logs for planning errors

```bash
# Backend logs
tail -f logs/agent_max.log | grep Planning
```

### Execution stops after plan

- Check if you accidentally added approval flow without handling it
- Verify SSE stream continues after plan event

### Steps not updating

- Check `currentStep` state updates
- Verify `thinking` events include `step` field

## Next Steps

1. Test with various tasks (simple file, complex app, multi-step workflow)
2. Gather UX feedback on plan display
3. Add animations/transitions
4. Implement approval flow if desired
5. Add plan history/replay feature

---

**Status**: ✅ Backend complete | ⏳ Frontend integration in progress

The plan generation and streaming is working! Just integrate the ExecutionPlan component into AppleFloatBar to see it in action.
