const FALLBACK_BODY = "Review Max's question to continue the task.";
const MAX_BODY_LENGTH = 160;
const MINI_WINDOW_MAX_SIZE = 100;

let NotificationClass = null;
let getMainWindow = () => null;
let focusApp = () => {};
const shownKeys = new Set();
const pendingNotifications = new Map();

function configureReviewNotifications(options = {}) {
  NotificationClass = options.Notification || NotificationClass;
  getMainWindow = options.getMainWindow || getMainWindow;
  focusApp = options.focusApp || focusApp;
}

function normalizeIdentifier(value, fallback) {
  const normalized = String(value || '')
    .replace(/[^a-zA-Z0-9._:-]/g, '-')
    .slice(0, 120);
  return normalized || fallback;
}

function createReviewKey({ source, runId, questionId, timestamp }) {
  return [
    normalizeIdentifier(source, 'executor'),
    normalizeIdentifier(runId, 'unknown-run'),
    normalizeIdentifier(questionId || timestamp, 'unknown-question'),
  ].join(':');
}

function sanitizeNotificationBody(question) {
  if (typeof question !== 'string') return FALLBACK_BODY;

  const normalized = question.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return FALLBACK_BODY;

  const sensitivePattern =
    /(api[\s_-]?key|authorization|bearer\s+[a-z0-9._-]+|password|private[\s_-]?key|secret|credential|access[\s_-]?token|refresh[\s_-]?token)/i;
  if (sensitivePattern.test(normalized)) return FALLBACK_BODY;

  if (normalized.length <= MAX_BODY_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_BODY_LENGTH - 3).trimEnd()}...`;
}

function isWindowCollapsed(window) {
  try {
    const bounds = window?.getBounds?.();
    return Boolean(
      bounds && (bounds.width <= MINI_WINDOW_MAX_SIZE || bounds.height <= MINI_WINDOW_MAX_SIZE)
    );
  } catch {
    return false;
  }
}

function shouldNotify(window) {
  if (!window || window.isDestroyed?.()) return false;
  return !window.isVisible?.() || !window.isFocused?.() || isWindowCollapsed(window);
}

function openPendingReview(payload) {
  const window = getMainWindow();
  if (!window || window.isDestroyed?.()) return;

  try {
    focusApp();
    if (!window.isVisible?.()) window.show?.();
    window.show?.();
    window.focus?.();
    window.webContents?.send?.('review-notification:open', {
      source: payload.source,
      runId: payload.runId || null,
      questionId: payload.questionId || null,
    });
  } catch (error) {
    console.warn('[ReviewNotifications] Failed to focus pending review:', error.message);
  }
}

function notifyReviewRequired(payload = {}) {
  const key = createReviewKey(payload);
  if (shownKeys.has(key)) return { shown: false, reason: 'duplicate', key };

  const window = getMainWindow();
  if (!shouldNotify(window)) return { shown: false, reason: 'focused', key };
  if (!NotificationClass || NotificationClass.isSupported?.() === false) {
    return { shown: false, reason: 'unsupported', key };
  }

  try {
    const notification = new NotificationClass({
      title: 'Max needs your input',
      body: sanitizeNotificationBody(payload.question),
      silent: true,
    });

    notification.on?.('click', () => openPendingReview(payload));
    notification.show();
    shownKeys.add(key);
    pendingNotifications.set(key, notification);
    return { shown: true, key };
  } catch (error) {
    console.warn('[ReviewNotifications] Failed to show notification:', error.message);
    return { shown: false, reason: 'failed', key };
  }
}

function clearPendingReview(payload = {}) {
  const key = createReviewKey(payload);
  const notification = pendingNotifications.get(key);
  try {
    notification?.close?.();
  } catch {}
  pendingNotifications.delete(key);
}

function resetReviewNotificationsForTests() {
  shownKeys.clear();
  pendingNotifications.clear();
  NotificationClass = null;
  getMainWindow = () => null;
  focusApp = () => {};
}

module.exports = {
  FALLBACK_BODY,
  configureReviewNotifications,
  createReviewKey,
  sanitizeNotificationBody,
  shouldNotify,
  notifyReviewRequired,
  clearPendingReview,
  resetReviewNotificationsForTests,
};
