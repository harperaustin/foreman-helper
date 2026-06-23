(function() {
// Foreman Messages Notify — pure decision helpers + tolerant DOM helpers for the
// "You have new messages" notification box. Kept free of timers so tests can
// exercise the decision logic without a live setInterval. The baseline is a
// composite key object { createdAt, id } (or null) so equal timestamps are
// disambiguated by id.

var POLL_INTERVAL_MS = 4000;

// Composite comparison: a and b are { createdAt, id } objects.
function keyGreater(a, b) {
  if (a.createdAt > b.createdAt) return true;
  if (a.createdAt < b.createdAt) return false;
  return String(a.id) > String(b.id);
}

// Validate external input and return the newest { createdAt, id } key, or null.
function newestKey(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || typeof m !== 'object') continue;
    if (typeof m.createdAt !== 'string') continue;
    var key = { createdAt: m.createdAt, id: (m.id != null ? String(m.id) : '') };
    if (best === null || keyGreater(key, best)) {
      best = key;
    }
  }
  return best;
}

// Pure decision function: no DOM, no timers.
function decideNotification(inboxList, baseline, isMessagesActive) {
  var newest = newestKey(inboxList);
  if (isMessagesActive === true) {
    // Viewing the Messages tab marks everything seen → advance baseline to newest.
    return { show: false, hasNew: false, newBaseline: (newest !== null ? newest : (baseline || null)) };
  }
  if (baseline == null) {
    // Seed only: historical/pre-existing messages never fire.
    return { show: false, hasNew: false, newBaseline: (newest !== null ? newest : null) };
  }
  var hasNew = newest !== null && keyGreater(newest, baseline);
  // Keep baseline unchanged so it stays "new" until viewed.
  return { show: hasNew, hasNew: hasNew, newBaseline: baseline };
}

function getEl() {
  return (typeof document !== 'undefined') ? document.getElementById('message-notification') : null;
}

function show() {
  var n = getEl();
  if (!n) return false;
  n.hidden = false;
  return true;
}

function hide() {
  var n = getEl();
  if (!n) return false;
  n.hidden = true;
  return true;
}

var ForemanMessagesNotify = {
  POLL_INTERVAL_MS: POLL_INTERVAL_MS,
  keyGreater: keyGreater,
  newestKey: newestKey,
  decideNotification: decideNotification,
  getEl: getEl,
  show: show,
  hide: hide
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesNotify = ForemanMessagesNotify;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesNotify;
}

})();
