/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// A. Pure decideNotification unit tests
// ---------------------------------------------------------------------------
describe('decideNotification (pure)', () => {
  let Notify;
  beforeEach(() => {
    jest.resetModules();
    Notify = require('../js/messages-notify.js');
  });

  test('empty/null/non-array inbox with baseline → unchanged, no show', () => {
    const baseline = { createdAt: '2026-01-01T00:00:00Z', id: 'a' };
    [[], null, 'nope', 42].forEach((inbox) => {
      const r = Notify.decideNotification(inbox, baseline, false);
      expect(r).toEqual({ show: false, hasNew: false, newBaseline: baseline });
    });
  });

  test('seed path: baseline null + messages present + not active → seed only, no show', () => {
    const inbox = [
      { id: 'm1', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', createdAt: '2026-01-02T00:00:00Z' }
    ];
    const r = Notify.decideNotification(inbox, null, false);
    expect(r.show).toBe(false);
    expect(r.hasNew).toBe(false);
    expect(r.newBaseline).toEqual({ createdAt: '2026-01-02T00:00:00Z', id: 'm2' });
  });

  test('new message present + baseline set + not active → show, baseline NOT advanced', () => {
    const baseline = { createdAt: '2026-01-01T00:00:00Z', id: 'a' };
    const inbox = [{ id: 'm2', createdAt: '2026-01-02T00:00:00Z' }];
    const r = Notify.decideNotification(inbox, baseline, false);
    expect(r.show).toBe(true);
    expect(r.hasNew).toBe(true);
    expect(r.newBaseline).toEqual(baseline);
  });

  test('isMessagesActive=true → no show, baseline advanced to newest', () => {
    const baseline = { createdAt: '2026-01-01T00:00:00Z', id: 'a' };
    const inbox = [{ id: 'm2', createdAt: '2026-01-02T00:00:00Z' }];
    const r = Notify.decideNotification(inbox, baseline, true);
    expect(r.show).toBe(false);
    expect(r.hasNew).toBe(false);
    expect(r.newBaseline).toEqual({ createdAt: '2026-01-02T00:00:00Z', id: 'm2' });
  });

  test('isMessagesActive=true with empty inbox keeps existing baseline', () => {
    const baseline = { createdAt: '2026-01-01T00:00:00Z', id: 'a' };
    const r = Notify.decideNotification([], baseline, true);
    expect(r.newBaseline).toEqual(baseline);
  });

  test('baseline equals newest + not active → no show', () => {
    const baseline = { createdAt: '2026-01-02T00:00:00Z', id: 'm2' };
    const inbox = [{ id: 'm2', createdAt: '2026-01-02T00:00:00Z' }];
    const r = Notify.decideNotification(inbox, baseline, false);
    expect(r.show).toBe(false);
    expect(r.hasNew).toBe(false);
  });

  test('equal-timestamp tie-break: higher id detected as new', () => {
    const T = '2026-01-01T00:00:00Z';
    const baseline = { createdAt: T, id: 'a' };
    const inbox = [{ id: 'b', createdAt: T }];
    const r = Notify.decideNotification(inbox, baseline, false);
    expect(r.show).toBe(true);
    expect(r.hasNew).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B. newestKey unit tests
// ---------------------------------------------------------------------------
describe('newestKey (pure)', () => {
  let Notify;
  beforeEach(() => {
    jest.resetModules();
    Notify = require('../js/messages-notify.js');
  });

  test('returns null for [], null, non-array', () => {
    expect(Notify.newestKey([])).toBeNull();
    expect(Notify.newestKey(null)).toBeNull();
    expect(Notify.newestKey('x')).toBeNull();
    expect(Notify.newestKey(7)).toBeNull();
  });

  test('returns the max key for a list', () => {
    const list = [
      { id: 'a', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'c', createdAt: '2026-01-03T00:00:00Z' },
      { id: 'b', createdAt: '2026-01-02T00:00:00Z' }
    ];
    expect(Notify.newestKey(list)).toEqual({ createdAt: '2026-01-03T00:00:00Z', id: 'c' });
  });

  test('ignores items missing/with non-string createdAt and null items', () => {
    const list = [
      null,
      { id: 'x' },
      { id: 'y', createdAt: 12345 },
      'string',
      { id: 'good', createdAt: '2026-01-05T00:00:00Z' }
    ];
    expect(Notify.newestKey(list)).toEqual({ createdAt: '2026-01-05T00:00:00Z', id: 'good' });
  });

  test('returns null if no valid items present', () => {
    expect(Notify.newestKey([null, { id: 'x' }, { createdAt: 1 }])).toBeNull();
  });

  test('tie-breaks equal createdAt by id', () => {
    const T = '2026-01-01T00:00:00Z';
    const r = Notify.newestKey([{ id: 'a', createdAt: T }, { id: 'b', createdAt: T }]);
    expect(r).toEqual({ createdAt: T, id: 'b' });
  });

  test('coerces missing id to empty string', () => {
    const r = Notify.newestKey([{ createdAt: '2026-01-01T00:00:00Z' }]);
    expect(r).toEqual({ createdAt: '2026-01-01T00:00:00Z', id: '' });
  });
});

// ---------------------------------------------------------------------------
// C. DOM show/hide tests
// ---------------------------------------------------------------------------
describe('show/hide DOM helpers', () => {
  let Notify;
  beforeEach(() => {
    jest.resetModules();
    Notify = require('../js/messages-notify.js');
    document.body.innerHTML = '';
  });

  test('show() sets hidden=false and returns true', () => {
    document.body.innerHTML = '<div id="message-notification" hidden></div>';
    expect(Notify.show()).toBe(true);
    expect(document.getElementById('message-notification').hidden).toBe(false);
  });

  test('hide() sets hidden=true and returns true', () => {
    document.body.innerHTML = '<div id="message-notification"></div>';
    expect(Notify.hide()).toBe(true);
    expect(document.getElementById('message-notification').hidden).toBe(true);
  });

  test('show()/hide() are no-ops returning false when element absent', () => {
    document.body.innerHTML = '';
    expect(Notify.show()).toBe(false);
    expect(Notify.hide()).toBe(false);
  });

  test('getEl returns the element or null', () => {
    document.body.innerHTML = '<div id="message-notification"></div>';
    expect(Notify.getEl()).not.toBeNull();
    document.body.innerHTML = '';
    expect(Notify.getEl()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D. Markup / structure tests
// ---------------------------------------------------------------------------
describe('index.html notification markup', () => {
  beforeEach(() => {
    document.body.innerHTML = indexHtml;
  });

  test('#message-notification exists with role=status, aria-live=polite, static text', () => {
    const el = document.getElementById('message-notification');
    expect(el).not.toBeNull();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.textContent).toContain('You have new messages');
  });

  test('#message-notification is NOT inside nav.tab-nav', () => {
    const nav = document.querySelector('nav.tab-nav');
    expect(nav).not.toBeNull();
    expect(nav.contains(document.getElementById('message-notification'))).toBe(false);
  });

  test('nav.tab-nav direct .tab-btn ids unchanged (pin)', () => {
    const nav = document.querySelector('nav.tab-nav');
    const ids = Array.from(nav.querySelectorAll(':scope > .tab-btn')).map((b) => b.id);
    expect(ids).toEqual(['tab-pipeline', 'tab-harness', 'tab-profile', 'tab-users', 'tab-messages']);
  });

  test('messages-notify.js script tag appears before app.js', () => {
    const notifyIdx = indexHtml.indexOf('js/messages-notify.js');
    const appIdx = indexHtml.indexOf('js/app.js');
    expect(notifyIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeGreaterThan(-1);
    expect(notifyIdx).toBeLessThan(appIdx);
  });
});

// ---------------------------------------------------------------------------
// E. jsdom integration tests
// ---------------------------------------------------------------------------
describe('notification integration', () => {
  let currentUser;
  let inboxData;
  let renderMessages;
  let Notify;

  function flush() {
    return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
  }

  function notifEl() {
    return document.getElementById('message-notification');
  }

  function setActivePanel(id) {
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('active');
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    localStorage.clear();
    sessionStorage.clear();

    document.documentElement.innerHTML = indexHtml;

    currentUser = null;
    inboxData = [];
    renderMessages = jest.fn();

    Notify = require('../js/messages-notify.js');

    window.ForemanMessagesNotify = Notify;
    window.ForemanMessagesAPI = {
      getCurrentUser: function() { return Promise.resolve(currentUser); },
      inbox: function() { return Promise.resolve(inboxData); }
    };
    window.ForemanMessagesUI = {
      renderMessages: renderMessages
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function startApp() {
    require('../js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }

  async function tick() {
    jest.advanceTimersByTime(Notify.POLL_INTERVAL_MS);
    await flush();
  }

  test('toast appears off Messages tab when a new message arrives', async () => {
    currentUser = { id: 'u1' };
    inboxData = [{ id: 'm0', createdAt: '2026-01-01T00:00:00Z' }];
    setActivePanel('panel-pipeline');
    startApp();
    await flush(); // immediate poll seeds baseline
    expect(notifEl().hidden).toBe(true);

    inboxData = [
      { id: 'm0', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm1', createdAt: '2026-02-01T00:00:00Z' }
    ];
    await tick();
    expect(notifEl().hidden).toBe(false);
  });

  test('inbox re-renders live on the Messages tab', async () => {
    currentUser = { id: 'u1' };
    inboxData = [{ id: 'm1', createdAt: '2026-02-01T00:00:00Z' }];
    setActivePanel('panel-messages');
    startApp();
    await flush();

    inboxData = [
      { id: 'm1', createdAt: '2026-02-01T00:00:00Z' },
      { id: 'm2', createdAt: '2026-02-02T00:00:00Z' }
    ];
    await tick();
    expect(renderMessages).toHaveBeenCalled();
    expect(notifEl().hidden).toBe(true);
  });

  test('toast clears when Messages tab is clicked', async () => {
    currentUser = { id: 'u1' };
    inboxData = [{ id: 'm0', createdAt: '2026-01-01T00:00:00Z' }];
    setActivePanel('panel-pipeline');
    startApp();
    await flush();

    inboxData = [
      { id: 'm0', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm1', createdAt: '2026-02-01T00:00:00Z' }
    ];
    await tick();
    expect(notifEl().hidden).toBe(false);

    document.getElementById('tab-messages').click();
    await flush();
    expect(notifEl().hidden).toBe(true);
  });

  test('signed-out keeps toast hidden + clears it', async () => {
    currentUser = null;
    inboxData = [{ id: 'm1', createdAt: '2026-02-01T00:00:00Z' }];
    setActivePanel('panel-pipeline');
    startApp();
    await flush();
    expect(notifEl().hidden).toBe(true);

    await tick();
    expect(notifEl().hidden).toBe(true);
  });

  test('auth transition via poll: load signed-out then sign in → no false toast', async () => {
    currentUser = null;
    inboxData = [{ id: 'm1', createdAt: '2026-02-01T00:00:00Z' }];
    setActivePanel('panel-pipeline');
    startApp();
    await flush();
    expect(notifEl().hidden).toBe(true);

    currentUser = { id: 'u1' }; // same pre-existing inbox
    await tick();
    expect(notifEl().hidden).toBe(true);
  });

  test('eager auth-event reset: same-user logout→login before next poll → no false toast', async () => {
    currentUser = { id: 'A' };
    inboxData = [{ id: 'm1', createdAt: '2026-01-01T00:00:00Z' }];
    setActivePanel('panel-pipeline');
    startApp();
    await flush(); // seeds baseline for user A
    expect(notifEl().hidden).toBe(true);

    // Logout while a new message "arrives" signed out.
    currentUser = null;
    window.dispatchEvent(new window.CustomEvent('foreman:auth-changed'));
    // Eager listener hides immediately (before any timer advance).
    expect(notifEl().hidden).toBe(true);
    inboxData.push({ id: 'm2', createdAt: '2026-01-02T00:00:00Z' });

    // Same user logs back in BEFORE the next poll.
    currentUser = { id: 'A' };
    window.dispatchEvent(new window.CustomEvent('foreman:auth-changed'));
    expect(notifEl().hidden).toBe(true);

    // Now advance one interval: first post-login poll seeds only, no false toast.
    await tick();
    expect(notifEl().hidden).toBe(true);
  });
});
