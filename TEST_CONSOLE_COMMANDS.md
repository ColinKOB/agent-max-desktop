# Console Test Commands for Apple FloatBar

Paste these commands in the Chrome DevTools console to verify the fixes:

## 1. Check if new Apple FloatBar is loaded
```javascript
// Should show AppleFloatBar component exists
console.log('Apple FloatBar loaded:', !!document.querySelector('.apple-floatbar-root'));
console.log('Old FloatBar removed:', !document.querySelector('.amx-root.amx-bar'));
```

## 2. Verify glassmorphism with 40px blur
```javascript
// Check glass effect on the bar
const glass = document.querySelector('.apple-bar-glass');
if (glass) {
  const styles = getComputedStyle(glass);
  console.table({
    backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter,
    background: styles.background,
    border: styles.border,
    boxShadow: styles.boxShadow
  });
} else {
  console.log('Bar not expanded - click the pill first');
}
```

## 3. Test expanding/collapsing
```javascript
// Simulate clicking the mini pill to expand
const mini = document.querySelector('.apple-mini-content');
if (mini) {
  mini.click();
  console.log('Expanding bar...');
} else {
  console.log('Already expanded or component not found');
}
```

## 4. Check centering and positioning
```javascript
// Verify bar is centered
const root = document.querySelector('.apple-floatbar-root');
const container = document.querySelector('.apple-bar-container');
if (root && container) {
  const rootStyles = getComputedStyle(root);
  const containerStyles = getComputedStyle(container);
  console.table({
    rootDisplay: rootStyles.display,
    rootAlignItems: rootStyles.alignItems,
    rootJustifyContent: rootStyles.justifyContent,
    containerWidth: containerStyles.width,
    containerMaxWidth: containerStyles.maxWidth,
    containerPosition: container.getBoundingClientRect()
  });
}
```

## 5. Test message sending (no freeze)
```javascript
// Send a test message
const input = document.querySelector('.apple-input');
const sendBtn = document.querySelector('.apple-send-btn');
if (input && sendBtn) {
  input.value = 'Test message - checking for freezing';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  sendBtn.click();
  console.log('Message sent - monitor for freezing');
} else {
  console.log('Input/send button not found - expand bar first');
}
```

## 6. Verify no card mode exists
```javascript
// Should return empty/no elements
console.log('Card elements found:', document.querySelectorAll('.amx-card, .amx-panel').length);
console.log('Card state in component:', document.querySelector('.apple-floatbar-root.card'));
```

## 7. Check toolbar buttons
```javascript
// List all toolbar buttons
const buttons = document.querySelectorAll('.apple-tool-btn');
console.log('Toolbar buttons:', buttons.length);
buttons.forEach((btn, i) => {
  console.log(`Button ${i + 1}:`, btn.title || btn.getAttribute('aria-label'));
});
```

## 8. Monitor window resizing (no infinite loop)
```javascript
// Watch for resize events
let resizeCount = 0;
const observer = new ResizeObserver(() => {
  resizeCount++;
  console.log(`Resize #${resizeCount} at ${new Date().toTimeString().split(' ')[0]}`);
});

const bar = document.querySelector('.apple-bar-container');
if (bar) {
  observer.observe(bar);
  console.log('Monitoring resizes for 10 seconds...');
  setTimeout(() => {
    observer.disconnect();
    console.log(`Total resizes in 10s: ${resizeCount}`);
    console.log(resizeCount > 50 ? '⚠️ Possible resize loop!' : '✅ Resize behavior normal');
  }, 10000);
} else {
  console.log('Bar not found - expand first');
}
```

## 9. Performance check
```javascript
// Check for performance issues
const checkPerformance = () => {
  const start = performance.now();
  requestAnimationFrame(() => {
    const frameTime = performance.now() - start;
    console.log(`Frame time: ${frameTime.toFixed(2)}ms`);
    if (frameTime > 16.67) {
      console.warn('⚠️ Frame dropped - possible performance issue');
    } else {
      console.log('✅ Performance normal');
    }
  });
};

// Run 5 checks
for (let i = 0; i < 5; i++) {
  setTimeout(checkPerformance, i * 200);
}
```

## 10. Full system check
```javascript
// Run all checks at once
(() => {
  const results = {
    appleFloatBarLoaded: !!document.querySelector('.apple-floatbar-root'),
    oldFloatBarRemoved: !document.querySelector('.amx-root.amx-bar'),
    glassMorphismActive: false,
    centered: false,
    noCardMode: document.querySelectorAll('.amx-card').length === 0,
    toolbarPresent: false,
    inputWorking: false
  };
  
  // Check glass
  const glass = document.querySelector('.apple-bar-glass');
  if (glass) {
    const styles = getComputedStyle(glass);
    results.glassMorphismActive = styles.backdropFilter?.includes('blur(40px)') || 
                                   styles.webkitBackdropFilter?.includes('blur(40px)');
  }
  
  // Check centering
  const root = document.querySelector('.apple-floatbar-root');
  if (root) {
    const styles = getComputedStyle(root);
    results.centered = styles.justifyContent === 'center' && styles.alignItems === 'center';
  }
  
  // Check toolbar
  results.toolbarPresent = document.querySelectorAll('.apple-tool-btn').length >= 3;
  
  // Check input
  results.inputWorking = !!document.querySelector('.apple-input');
  
  console.table(results);
  
  const passed = Object.values(results).filter(v => v).length;
  console.log(`\n✅ Passed: ${passed}/7 checks`);
  
  if (passed === 7) {
    console.log('🎉 All systems operational! Apple FloatBar is working correctly.');
  } else {
    console.log('⚠️ Some checks failed. Expand the bar and run again if needed.');
  }
})();
```
