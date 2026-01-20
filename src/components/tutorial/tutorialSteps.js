/**
 * Tutorial Step Definitions
 * Configures each step of the in-app tutorial for new users.
 */

export const TUTORIAL_STEPS = [
  {
    id: 'pill',
    target: '[data-tutorial="pill"]',
    title: "Hey, it's me!",
    content: "Click anywhere on this little guy to open the full chat window. You can drag me around your screen too!",
    position: 'right',
    waitForExpand: true,
    highlightPadding: 8,
  },
  {
    id: 'input',
    target: '[data-tutorial="input-area"]',
    title: 'This is where the magic happens',
    content: "Type any question or task here. I can help with writing, research, coding, scheduling... basically anything you can think of!",
    position: 'top',
    highlightPadding: 0,
    highlightBorderRadius: 0, // Match the rectangular input area
    offsetY: -70, // Move tooltip up more
  },
  {
    id: 'attach',
    target: '[data-tutorial="attach"]',
    title: 'Share files with me',
    content: "Click the + button to add images, PDFs, or documents. I can read what's inside and help you with it!",
    position: 'top',
    highlightPadding: 6,
    offsetY: -40,
  },
  {
    id: 'send',
    target: '[data-tutorial="send"]',
    title: "Ready? Let's chat!",
    content: 'Click this button (or just press Enter) to send your message. Go ahead, try asking me something!',
    position: 'top',
    highlightPadding: 6,
    offsetY: -40,
  },
  {
    id: 'context',
    target: '[data-tutorial="context"]',
    title: "Your conversation's memory",
    content: "This little bar fills up as we chat. When it gets full, click it to start fresh. Don't worry - I'll still remember who you are!",
    position: 'bottom',
    highlightPadding: 6,
    offsetY: 20,
  },
  {
    id: 'settings',
    target: '[data-tutorial="settings"]',
    title: 'Make me yours',
    content: 'Customize how I work - change my mode, connect your Google account, tweak my personality, and more. Explore when you\'re ready!',
    position: 'bottom',
    isLast: true,
    highlightPadding: 6,
    offsetY: 20,
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
