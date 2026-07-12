import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const floatBarPath = path.resolve('src/components/FloatBar/AppleFloatBar.jsx');
const creditDisplayPath = path.resolve('src/components/CreditDisplay.jsx');
const electronMainPath = path.resolve('electron/main/main.cjs');
const floatBarSource = fs.readFileSync(floatBarPath, 'utf8');
const creditDisplaySource = fs.readFileSync(creditDisplayPath, 'utf8');
const electronMainSource = fs.readFileSync(electronMainPath, 'utf8');

describe('expanded toolbar contract', () => {
  it('removes the retired Auto control and mode overlay', () => {
    expect(floatBarSource).not.toContain('toolMenuOpen');
    expect(floatBarSource).not.toContain('Mode Badge');
  });

  it('renders the permanent controls in the specified order', () => {
    const toolbarStart = floatBarSource.indexOf('className="apple-toolbar"');
    const toolbarEnd = floatBarSource.indexOf('{/* Onboarding overlay', toolbarStart);
    const toolbar = floatBarSource.slice(toolbarStart, toolbarEnd);
    const controls = [
      toolbar.indexOf('<LayoutGrid'),
      toolbar.indexOf('<CreditDisplay'),
      toolbar.indexOf('context-usage-btn'),
      toolbar.indexOf('<Settings'),
      toolbar.indexOf('<Minimize2'),
    ];

    expect(controls.every((position) => position >= 0)).toBe(true);
    expect(controls).toEqual([...controls].sort((a, b) => a - b));
  });

  it('shows backend connectivity only for the offline state', () => {
    expect(floatBarSource).toContain('{!backendConnected && (');
    expect(floatBarSource).not.toContain('<Wifi ');
  });

  it('opens context details without directly clearing the conversation', () => {
    const contextStart = floatBarSource.indexOf('context-usage-btn');
    const contextEnd = floatBarSource.indexOf('{!backendConnected', contextStart);
    const contextControl = floatBarSource.slice(contextStart, contextEnd);

    expect(contextControl).toContain('setContextPopoverOpen');
    expect(contextControl).not.toContain('onClick={handleClear}');
    expect(contextControl).toContain('New Conversation');
  });

  it('makes the credit balance identifiable and actionable', () => {
    expect(creditDisplaySource).toContain('<Coins size={12}');
    expect(creditDisplaySource).toContain('Open billing and usage.');
    expect(creditDisplaySource).toContain('onClick={handleOpenBilling}');
  });

  it('keeps the fixed-size float bar at 100 percent renderer zoom', () => {
    expect(electronMainSource).toContain('mainWindow?.webContents?.setZoomFactor(1)');
    expect(electronMainSource).toContain("mainWindow.webContents.on('zoom-changed'");
  });
});
