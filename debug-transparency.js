/**
 * Transparency Debug Script
 * Run this in Electron DevTools Console to diagnose background issues
 *
 * To use:
 * 1. Open Electron app
 * 2. Press Cmd+Option+I to open DevTools
 * 3. Copy/paste this entire script
 * 4. Press Enter
 */

console.log('🔍 Starting Transparency Debug...\n');

// Check all elements for backgrounds
function checkBackgrounds() {
  const results = [];

  // Elements to check
  const selectors = [
    'html',
    'body',
    '#root',
    '.amx-root',
    '.amx-mini',
    '.amx-bar',
    '.amx-card',
    '.amx-panel',
    '.amx-welcome',
  ];

  selectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) {
      const styles = window.getComputedStyle(el);
      results.push({
        selector,
        background: styles.background,
        backgroundColor: styles.backgroundColor,
        backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter,
        opacity: styles.opacity,
      });
    } else {
      results.push({
        selector,
        found: false,
      });
    }
  });

  return results;
}

// Check Electron window properties
function checkElectronWindow() {
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    console.log('✅ Running in Electron');
    console.log('Electron version:', process.versions.electron);
    console.log('Chrome version:', process.versions.chrome);
    console.log('Node version:', process.versions.node);
  } else {
    console.log('⚠️ Not running in Electron');
  }
}

// Run all checks
console.log('='.repeat(50));
console.log('ELECTRON INFO:');
console.log('='.repeat(50));
checkElectronWindow();

console.log(`\n${'='.repeat(50)}`);
console.log('ELEMENT BACKGROUNDS:');
console.log('='.repeat(50));
const backgrounds = checkBackgrounds();
console.table(backgrounds);

console.log(`\n${'='.repeat(50)}`);
console.log('BACKDROP FILTER SUPPORT:');
console.log('='.repeat(50));
const testEl = document.createElement('div');
testEl.style.backdropFilter = 'blur(10px)';
testEl.style.webkitBackdropFilter = 'blur(10px)';
document.body.appendChild(testEl);
const computed = window.getComputedStyle(testEl);
console.log('backdrop-filter:', computed.backdropFilter);
console.log('-webkit-backdrop-filter:', computed.webkitBackdropFilter);
console.log('Supported:', computed.backdropFilter !== '' || computed.webkitBackdropFilter !== '');
document.body.removeChild(testEl);

console.log(`\n${'='.repeat(50)}`);
console.log('PROBLEMATIC ELEMENTS (Non-transparent):');
console.log('='.repeat(50));

// Find all elements with non-transparent backgrounds
const allElements = document.querySelectorAll('*');
const problematic = [];
allElements.forEach((el) => {
  const styles = window.getComputedStyle(el);
  const bg = styles.backgroundColor;

  // Check if background is not transparent/rgba(0,0,0,0)
  if (
    bg &&
    bg !== 'transparent' &&
    bg !== 'rgba(0, 0, 0, 0)' &&
    !bg.includes('rgba(0, 0, 0, 0)') &&
    !bg.includes('rgba(255, 255, 255, 0)')
  ) {
    // Get element identifier
    let identifier = el.tagName.toLowerCase();
    if (el.id) identifier += `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className
        .split(' ')
        .filter((c) => c)
        .slice(0, 3)
        .join('.');
      if (classes) identifier += `.${classes}`;
    }

    problematic.push({
      element: identifier,
      backgroundColor: bg,
      zIndex: styles.zIndex,
      position: styles.position,
    });
  }
});

if (problematic.length > 0) {
  console.log(`Found ${problematic.length} elements with non-transparent backgrounds:`);
  console.table(problematic.slice(0, 20)); // Show first 20
} else {
  console.log('✅ No problematic elements found!');
}

console.log(`\n${'='.repeat(50)}`);
console.log('RECOMMENDATIONS:');
console.log('='.repeat(50));

// Analyze results
const card = backgrounds.find((b) => b.selector === '.amx-card');
if (card && card.backdropFilter && card.backdropFilter !== 'none') {
  console.log('✅ CSS backdrop-filter is applied');
} else {
  console.log('❌ CSS backdrop-filter is NOT applied or not working');
}

if (problematic.length > 5) {
  console.log('⚠️ Many elements have backgrounds - check CSS');
}

console.log('\n🔍 Debug complete!');
