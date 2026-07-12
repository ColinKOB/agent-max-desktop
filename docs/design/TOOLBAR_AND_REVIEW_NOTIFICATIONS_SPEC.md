# Toolbar and Human Review Notifications Specification

**Status:** Implemented in source, packaged-app verification pending
**Date:** July 10, 2026
**Owner:** Agent Max Desktop
**Primary surface:** Expanded floating bar

## 1. Summary

Simplify the expanded Agent Max toolbar so every permanent control has a clear purpose, and notify the user through a native desktop notification when Max is blocked waiting for human input.

The toolbar will contain five controls:

```text
[Tools] [Credits] [Context] [Settings] [Shrink]
```

Backend connectivity will appear only when degraded. The fixed `Auto` mode control will be removed. Human review state will not consume permanent toolbar space.

## 2. Goals

- Make every toolbar control understandable without prior knowledge of the app.
- Remove controls that no longer provide a meaningful choice.
- Prevent accidental conversation clearing from the context control.
- Make credit balance and context usage understandable and actionable.
- Alert the user when Max cannot continue without input.
- Bring the user directly to the pending question when they click a notification.
- Use one native notification implementation for every autonomous executor path.

## 3. Non-Goals

- Redesigning the conversation, composer, onboarding, Settings, Web, GridFlow, or Notes interfaces.
- Adding a permanent working-state dot to the expanded toolbar.
- Changing autonomous execution policy or approval boundaries.
- Changing credit pricing or accounting.
- Building, signing, notarizing, publishing, or releasing the desktop app.
- Replacing the collapsed mini pill or its existing working-state indicator.

## 4. Current Behavior and Problems

The current toolbar contains these controls:

| Control | Current behavior | Problem |
|---|---|---|
| `Auto` | Opens a toolbar-wide permission menu | Auto is the only mode, so the menu contains one option and cannot change behavior. |
| Green Wi-Fi | Shows backend connection health; retries when offline | A healthy connection occupies permanent space and resembles a network selector. |
| Credit number | Displays remaining credits | The number is unlabeled and cannot open usage or billing information. |
| Monitor icon | Opens Web, GridFlow, and Notes | The icon implies a monitor rather than a collection of Max tools. |
| Gear | Opens Settings | Behavior and icon are appropriate. |
| Pencil and percentage | Displays context usage; clicking clears the conversation | The pencil implies editing, and a subtle information control performs a destructive reset without an explicit action. |
| Diagonal arrows | Collapses the window | Behavior is appropriate, although the tooltip should consistently say `Shrink`. |

The status dot discussed elsewhere is rendered only in the collapsed mini pill. It is not part of the expanded toolbar and is outside this specification.

## 5. Proposed Toolbar

### 5.1 Order

From left to right:

1. Max's Tools
2. Credits
3. Context usage
4. Settings
5. Shrink

This order moves from task actions, to account and conversation information, to application utilities.

### 5.2 Shared Control Treatment

- Use the existing Lucide icon library and existing `apple-tool-btn` visual language.
- Preserve the current 30-pixel minimum target only if the complete hit area remains at least 36 by 36 pixels. Prefer a 40 by 40 pixel hit area when the float bar width permits it.
- Each icon-only button must have an accessible name and a native tooltip.
- Hover, focus, pressed, active, disabled, and error states must be visually distinct.
- Keyboard focus must be visible. The current CSS rule that removes focus outlines without a replacement must be changed for these controls.
- Do not use color as the only indicator of state.
- Tooltips should appear after a short delay and use plain labels, not implementation terminology.

## 6. Control Requirements

### 6.1 Max's Tools

**Visible form:** Toolbox or four-square grid icon.
**Tooltip and accessible name:** `Max's Tools`.

On activation:

- Open the existing tool launcher containing Web, GridFlow, and Notes.
- Preserve active-state treatment when any tool window is open.
- Keep the existing per-tool active indicators in the launcher.
- Return focus to the Tools button when the launcher closes.
- Close on Escape and outside click.

The monitor icon should be removed because it describes only one of the three destinations poorly.

### 6.2 Credits

**Visible form:** Small credit icon plus the formatted balance, for example `9,353`.
**Tooltip:** `9,353 credits remaining`.
**Accessible name:** Use the same complete phrase.

On activation:

- Open the existing billing or usage surface at the credit overview.
- Do not perform a purchase directly from the toolbar.
- Continue to update immediately when the balance changes.

States:

- Normal: neutral treatment.
- Low balance: warning treatment using both color and a tooltip message.
- Zero balance: error treatment and tooltip `No credits remaining`.
- Loading: stable-width skeleton or placeholder so the toolbar does not shift.
- Unavailable: show an error icon and allow retry without displaying a false zero.

Exact low-balance thresholds should reuse existing billing policy rather than introducing a second client-only definition.

### 6.3 Context Usage

**Visible form:** Gauge, brain, or memory icon plus percentage, for example `42%`.
**Tooltip:** `42% of conversation context used`.
**Accessible name:** Use the same complete phrase.

On activation:

- Open the context popover.
- Do not clear or reset the conversation.
- Show the percentage, a progress bar, a short explanation, and the explicit action `New Conversation`.
- Require the user to select `New Conversation` before calling the existing clear/reset flow.
- If the conversation contains messages, require a confirmation step unless an existing undo mechanism is available and reliable.

Thresholds:

- Under 60 percent: neutral.
- 60 through 84 percent: warning.
- 85 percent and above: critical.

The displayed threshold and tooltip threshold must use the same constants. The current mismatch between button and popover thresholds should be removed.

### 6.4 Settings

**Visible form:** Existing gear icon.
**Tooltip and accessible name:** `Settings`.

Behavior remains unchanged. Opening Settings must not close, clear, or otherwise mutate the current conversation.

### 6.5 Shrink

**Visible form:** Collapse or inward-arrows icon.
**Tooltip and accessible name:** `Shrink`.

On activation:

- Collapse the expanded float bar to the existing mini pill.
- Preserve the conversation and active autonomous run.
- Preserve pending human-review state so reopening returns to the pending question.

### 6.6 Backend Connectivity

Healthy connectivity should not occupy a permanent toolbar slot.

When disconnected:

- Insert a visible error control before Settings.
- Use an offline or cloud-off icon plus an accessible error label.
- Tooltip: `Max is offline. Click to retry.`
- Clicking retries the health check.
- Keep the control visible until a successful health check is confirmed.

When connection is restored:

- Announce restoration through an in-app toast or accessible live region.
- Remove the error control without shifting focus.
- Do not send a native desktop notification for routine reconnection.

## 7. Human Review Notifications

### 7.1 Trigger Definition

Send a notification when an autonomous run enters a real `waiting_for_user` state and Max cannot continue until the user responds.

This includes:

- A single `ask_user` question.
- A batched `ask_user` question set.
- A sensitive-action review that is represented through the same waiting state.

Do not use the initial permission preflight as the primary trigger. In Auto mode that path ordinarily auto-approves and is not the runtime state where Max is blocked.

### 7.2 Notification Conditions

Create a native notification only when all of the following are true:

- The question is valid and has been delivered to the renderer.
- The main Agent Max window is unfocused, hidden, or collapsed.
- A notification for the same run and question has not already been shown.
- Notifications are supported by the operating system.

If Agent Max is already focused and expanded, show the inline question without a native notification.

### 7.3 Notification Content

**Title:** `Max needs your input`
**Body:** A concise, sanitized summary of the question, limited to a safe display length.
**Fallback body:** `Review Max's question to continue the task.`

Requirements:

- Never place secrets, credentials, complete file contents, or raw command output in a notification.
- Do not include the complete approval payload.
- Use the application icon where supported.
- Do not play a custom sound by default. Respect system notification settings.

### 7.4 Notification Click Behavior

Clicking the notification must:

1. Show the main window if hidden.
2. Expand it if collapsed.
3. Move it into the visible work area if necessary.
4. Focus the window.
5. Scroll the pending question into view.
6. Move keyboard focus to the first valid response control.

The notification click must not approve, reject, or answer the question.

### 7.5 Deduplication and Lifecycle

- Use a stable key composed of executor source, run ID, and question ID or question timestamp.
- Store shown keys in memory for the lifetime of the desktop process.
- Do not notify again when the renderer re-renders the same question.
- A later distinct question in the same run may create a new notification.
- Clear the pending review state when the user answers, cancels, the run ends, or the five-minute executor timeout expires.
- If the question times out before a notification is clicked, focusing the app should show the resulting timeout or run status, not a stale interactive question.

## 8. Notification Architecture

### 8.1 Central Native Helper

Create one Electron main-process helper responsible for:

- Determining whether notification conditions are met.
- Sanitizing and truncating notification text.
- Deduplicating notifications.
- Constructing Electron `Notification` instances.
- Restoring, expanding, and focusing the main window on click.
- Reporting unsupported or failed notifications without interrupting execution.

Suggested location:

```text
electron/main/reviewNotifications.cjs
```

Suggested interface:

```javascript
notifyReviewRequired({
  source,
  runId,
  questionId,
  question,
  timestamp,
});

clearPendingReview({ source, runId, questionId });
```

The helper should receive a function that returns the current main window instead of importing mutable window state indirectly.

### 8.2 Executor Integration

Both executor paths must call the same helper immediately after delivering the question event to the renderer:

- `electron/autonomous/executorIPC.cjs`
- `electron/autonomous/pullExecutor.cjs`

The executor must not create its own independent notification implementation.

The current generic preload method `window.electron.showNotification()` should either:

- Be backed by a validated `show-notification` main-process handler for legitimate generic notifications, or
- Be removed if no production renderer uses it.

It must not remain exposed without a matching handler.

### 8.3 Renderer Focus Event

When a review notification is clicked, the main process should send a specific renderer event such as:

```text
review-notification:open
```

The payload should identify the pending question without containing sensitive question details. The renderer uses the identifier to expand the bar, locate the existing pending question, scroll it into view, and focus its first response control.

## 9. Implementation Areas

Expected files include:

- `src/components/FloatBar/AppleFloatBar.jsx`
  - Remove the Auto control and one-option mode overlay.
  - Reorder toolbar controls.
  - Change Tools and Context icons.
  - Make Context open a popover instead of clearing immediately.
  - Render connectivity only when degraded.
  - Handle the notification-open focus event.
- `src/components/FloatBar/AppleFloatBar.css`
  - Add visible keyboard focus and refined toolbar states.
  - Preserve stable dimensions and avoid layout shift.
- `src/components/CreditDisplay.jsx`
  - Add an explicit credit identity and billing navigation.
  - Add loading, unavailable, low, and zero states.
- `electron/main/main.cjs`
  - Register notification and renderer-focus wiring.
- `electron/main/reviewNotifications.cjs`
  - Centralize native review notification behavior.
- `electron/preload/preload.cjs`
  - Expose the narrow review-focus event and reconcile the generic notification API.
- `electron/autonomous/executorIPC.cjs`
  - Trigger and clear centralized notifications for legacy executor questions.
- `electron/autonomous/pullExecutor.cjs`
  - Trigger and clear centralized notifications for pull executor questions.

## 10. Accessibility Requirements

- Every toolbar control is reachable by keyboard in visual order.
- Every icon-only control has a unique accessible name.
- Focus indication meets WCAG 2.2 contrast and visibility expectations.
- Tool popovers support Escape, focus return, and no focus trapping unless modal.
- Context and credit warnings include text or accessible labels in addition to color.
- Dynamic offline and restored states are announced through a polite live region.
- A pending review question receives focus only after explicit notification activation, not merely when it arrives while the user is typing elsewhere.
- Reduced-motion preferences disable nonessential toolbar and popover animation.

## 11. Telemetry

Record product events without question text or sensitive payloads:

- `toolbar_tools_opened`
- `toolbar_credits_opened`
- `toolbar_context_opened`
- `toolbar_new_conversation_requested`
- `toolbar_connection_retry`
- `review_notification_shown`
- `review_notification_clicked`
- `review_notification_suppressed_focused`
- `review_notification_failed`

Include only source, run state, platform, and timing metadata required to diagnose delivery. Do not record the question body.

## 12. Testing Plan

### 12.1 Unit Tests

- Toolbar renders five permanent controls in the specified order.
- Auto and the one-option permission overlay are absent.
- Healthy connectivity is absent and offline connectivity is visible.
- Context activation opens the popover and does not call conversation reset.
- `New Conversation` invokes the existing reset flow only after explicit activation and required confirmation.
- Credit states render correct accessible names and stable dimensions.
- Notification deduplication accepts distinct questions and rejects duplicate keys.
- Notification sanitizer removes unsafe content and enforces the length limit.
- Notification click restores and focuses the main window without answering the question.

### 12.2 Integration Tests

- Legacy executor `ask_user` produces one pending review event.
- Pull executor `ask_user` produces one pending review event.
- Batched questions produce one notification for the batch, not one per option.
- Focused and expanded Max suppresses native notification delivery.
- Collapsed or unfocused Max sends a native notification.
- Clicking a notification expands Max and focuses the pending response control.
- Answer, cancel, completion, and timeout clear pending review state.
- Missing OS notification support does not fail the autonomous run.

### 12.3 User-Flow Verification

1. Start Max with a healthy backend and verify no connectivity control appears.
2. Confirm the five permanent toolbar controls match the specification.
3. Open each control and verify its label matches its behavior.
4. Click Context and verify the conversation remains intact.
5. Start a task that reaches `waiting_for_user`, collapse or unfocus Max, and verify one native notification appears.
6. Click the notification and verify Max opens at the unanswered question.
7. Answer the question and verify execution resumes without another notification for the same question.
8. Disconnect the backend and verify the retry control appears, works, and disappears after recovery.

## 13. Acceptance Criteria

- [x] The expanded toolbar permanently displays only Tools, Credits, Context, Settings, and Shrink.
- [x] The Auto control and its one-option overlay are removed.
- [x] A healthy backend connection does not occupy a toolbar slot.
- [x] An unhealthy backend exposes a labeled retry control.
- [x] Credits are identifiable and open usage or billing information.
- [x] Context usage no longer uses a pencil icon.
- [x] Clicking Context never clears the conversation directly.
- [x] New Conversation is an explicit, labeled action.
- [x] The expanded renderer, root, and float-bar container match the native window width at 100 percent zoom.
- [x] Max creates one notification request when an unfocused or collapsed run enters `waiting_for_user`.
- [x] Focused and expanded Max suppresses redundant native notification requests.
- [x] Clicking a review notification focuses the pending question without answering it.
- [x] Both executor implementations use the same notification helper.
- [x] The unmatched generic preload notification API is removed.
- [x] Toolbar controls meet keyboard, focus, tooltip, and reduced-motion requirements.
- [x] Focused unit and contract tests pass.
- [ ] Verify native notification delivery and click behavior in a packaged, signed macOS build.

## 14. Rollout Notes

- Implement behind a desktop feature flag only if notification behavior cannot be covered reliably before release.
- The toolbar simplification itself does not require a server migration.
- Notification behavior must be tested in a packaged, signed macOS build before release because development Electron notification behavior can differ from the installed application identity.
- Building and publishing the packaged app requires separate user approval and is not part of this specification.
