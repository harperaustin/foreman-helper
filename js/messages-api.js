(function() {
// Foreman Messages API — asynchronous boundary over ForemanMessagesDB.
// Sanitizes and validates external input, simulates network latency, and uses
// the active profile session to identify the sender and the recipient list.

var NETWORK_DELAY = 150;

function getDB() {
  if (typeof window !== 'undefined' && window.ForemanMessagesDB) {
    return window.ForemanMessagesDB;
  }
  if (typeof module !== 'undefined' && module.exports) {
    return require('./messages-db.js');
  }
  return null;
}

function getProfileAPI() {
  if (typeof window !== 'undefined' && window.ForemanProfileAPI) {
    return window.ForemanProfileAPI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    return require('./profile-api.js');
  }
  return null;
}

function delay(fn) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    }, NETWORK_DELAY);
  });
}

function sanitize(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).trim();
}

function getCurrentUser() {
  return getProfileAPI().getCurrentUser();
}

function listRecipients() {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return profile.listUsers().then(function(users) {
      if (!Array.isArray(users)) return [];
      var meId = me && me.id;
      return users.filter(function(u) {
        return u && u.id !== meId;
      });
    });
  });
}

function send(toId, toUsername, body) {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return delay(function() {
      if (!me || !me.id) {
        throw new Error('You must be signed in to send messages.');
      }
      var db = getDB();
      var cleanBody = sanitize(body);
      var cleanToId = sanitize(toId);
      var cleanToUsername = sanitize(toUsername);
      if (!cleanBody) throw new Error('Message body is required.');
      if (!cleanToId) throw new Error('Please choose a recipient.');
      return db.sendMessage(me.id, me.username, cleanToId, cleanToUsername, cleanBody);
    });
  });
}

function inbox() {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return delay(function() {
      if (!me || !me.id) {
        throw new Error('You must be signed in to view messages.');
      }
      return getDB().getInbox(me.id);
    });
  });
}

function sent() {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return delay(function() {
      if (!me || !me.id) {
        throw new Error('You must be signed in to view messages.');
      }
      return getDB().getSent(me.id);
    });
  });
}

var ForemanMessagesAPI = {
  NETWORK_DELAY: NETWORK_DELAY,
  send: send,
  inbox: inbox,
  sent: sent,
  listRecipients: listRecipients,
  getCurrentUser: getCurrentUser
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesAPI = ForemanMessagesAPI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesAPI;
}

})();
