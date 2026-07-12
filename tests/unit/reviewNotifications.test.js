import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import reviewNotifications from '../../electron/main/reviewNotifications.cjs';

const {
  FALLBACK_BODY,
  configureReviewNotifications,
  sanitizeNotificationBody,
  shouldNotify,
  notifyReviewRequired,
  clearPendingReview,
  resetReviewNotificationsForTests,
} = reviewNotifications;

class MockNotification {
  static instances = [];

  static isSupported() {
    return true;
  }

  constructor(options) {
    this.options = options;
    this.listeners = {};
    this.show = vi.fn();
    this.close = vi.fn();
    MockNotification.instances.push(this);
  }

  on(event, callback) {
    this.listeners[event] = callback;
  }

  emit(event) {
    this.listeners[event]?.();
  }
}

function createWindow({ focused = false, visible = true, width = 360, height = 300 } = {}) {
  return {
    isDestroyed: vi.fn(() => false),
    isFocused: vi.fn(() => focused),
    isVisible: vi.fn(() => visible),
    getBounds: vi.fn(() => ({ width, height })),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: { send: vi.fn() },
  };
}

describe('review notifications', () => {
  beforeEach(() => {
    resetReviewNotificationsForTests();
    MockNotification.instances = [];
  });

  it('sanitizes sensitive or oversized question text', () => {
    expect(sanitizeNotificationBody('Which folder should I use?')).toBe('Which folder should I use?');
    expect(sanitizeNotificationBody('Enter your API key')).toBe(FALLBACK_BODY);
    expect(sanitizeNotificationBody(`Choose one ${'x'.repeat(200)}`)).toHaveLength(160);
  });

  it('suppresses notifications only when the window is focused and expanded', () => {
    expect(shouldNotify(createWindow({ focused: true }))).toBe(false);
    expect(shouldNotify(createWindow({ focused: false }))).toBe(true);
    expect(shouldNotify(createWindow({ focused: true, width: 80, height: 80 }))).toBe(true);
    expect(shouldNotify(createWindow({ focused: true, visible: false }))).toBe(true);
  });

  it('deduplicates notifications for the same run and question', () => {
    const window = createWindow();
    configureReviewNotifications({ Notification: MockNotification, getMainWindow: () => window });
    const payload = { source: 'executor', runId: 'run-1', questionId: 'question-1', question: 'Continue?' };

    expect(notifyReviewRequired(payload).shown).toBe(true);
    expect(notifyReviewRequired(payload)).toMatchObject({ shown: false, reason: 'duplicate' });
    expect(MockNotification.instances).toHaveLength(1);
  });

  it('focuses Max and opens the pending review when the notification is clicked', () => {
    const window = createWindow({ visible: false });
    const focusApp = vi.fn();
    configureReviewNotifications({
      Notification: MockNotification,
      getMainWindow: () => window,
      focusApp,
    });
    const payload = { source: 'pull-executor', runId: 'run-2', questionId: 'question-2', question: 'Approve?' };

    notifyReviewRequired(payload);
    MockNotification.instances[0].emit('click');

    expect(focusApp).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.webContents.send).toHaveBeenCalledWith('review-notification:open', {
      source: 'pull-executor',
      runId: 'run-2',
      questionId: 'question-2',
    });
  });

  it('closes a pending notification when the review is resolved', () => {
    const window = createWindow();
    configureReviewNotifications({ Notification: MockNotification, getMainWindow: () => window });
    const payload = { source: 'executor', runId: 'run-3', questionId: 'question-3', question: 'Continue?' };

    notifyReviewRequired(payload);
    clearPendingReview(payload);

    expect(MockNotification.instances[0].close).toHaveBeenCalledOnce();
  });

  it('routes both executor implementations through the shared helper', () => {
    const executorIPC = fs.readFileSync(path.resolve('electron/autonomous/executorIPC.cjs'), 'utf8');
    const pullExecutor = fs.readFileSync(path.resolve('electron/autonomous/pullExecutor.cjs'), 'utf8');

    expect(executorIPC).toContain("require('../main/reviewNotifications.cjs')");
    expect(pullExecutor).toContain("require('../main/reviewNotifications.cjs')");
    expect(executorIPC).toContain('notifyReviewRequired(pendingAskUserReview)');
    expect(pullExecutor).toContain('notifyReviewRequired(reviewPayload)');
  });

  it('exposes only the narrow notification-click event to the renderer', () => {
    const preload = fs.readFileSync(path.resolve('electron/preload/preload.cjs'), 'utf8');

    expect(preload).toContain('onReviewNotificationOpen');
    expect(preload).not.toContain("ipcRenderer.invoke('show-notification'");
  });
});
