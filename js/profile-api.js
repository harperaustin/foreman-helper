(function() {
// Foreman Profile API — asynchronous boundary over ForemanProfileDB.
// Sanitizes and validates external input, simulates network latency, and
// manages the active session in sessionStorage.

var SESSION_KEY = 'foreman_session';
var NETWORK_DELAY = 150;

function getDB() {
  if (typeof window !== 'undefined' && window.ForemanProfileDB) {
    return window.ForemanProfileDB;
  }
  if (typeof module !== 'undefined' && module.exports) {
    return require('./profile-db.js');
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

function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function readSession() {
  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function register(username, password, avatar) {
  return delay(function() {
    var db = getDB();
    var u = sanitize(username);
    var p = sanitize(password);
    if (!u || !p) {
      throw new Error('Username and password are required.');
    }
    var a = sanitize(avatar);
    var user = db.createUser(u, p, a || undefined);
    setSession(user);
    return user;
  });
}

function login(username, password) {
  return delay(function() {
    var db = getDB();
    var u = sanitize(username);
    var p = sanitize(password);
    if (!u || !p) {
      throw new Error('Username and password are required.');
    }
    var user = db.verifyCredentials(u, p);
    if (!user) {
      throw new Error('Invalid username or password.');
    }
    setSession(user);
    return user;
  });
}

function getCurrentUser() {
  return delay(function() {
    var session = readSession();
    if (!session || !session.id) return null;
    var db = getDB();
    var fresh = db.getUser(session.id);
    if (fresh) {
      setSession(fresh);
      return fresh;
    }
    return session;
  });
}

function updateProfile(currentPassword, newUsername, newPassword, newAvatar) {
  return delay(function() {
    var db = getDB();
    var session = readSession();
    if (!session || !session.id) {
      throw new Error('You must be logged in to update your profile.');
    }

    var current = sanitize(currentPassword);
    if (!current) {
      throw new Error('Current password is required.');
    }

    var verified = db.verifyCredentials(session.username, current);
    if (!verified) {
      throw new Error('Current password is incorrect.');
    }

    var updates = {};
    var nextUsername = sanitize(newUsername);
    var nextPassword = sanitize(newPassword);
    var nextAvatar = sanitize(newAvatar);

    if (nextUsername && nextUsername !== session.username) {
      updates.username = nextUsername;
    }
    if (nextPassword) {
      updates.password = nextPassword;
    }
    if (nextAvatar && nextAvatar !== session.avatar) {
      updates.avatar = nextAvatar;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No changes to apply.');
    }

    var user = db.updateUser(session.id, updates);
    setSession(user);
    return user;
  });
}

function logout() {
  return delay(function() {
    sessionStorage.removeItem(SESSION_KEY);
    return { success: true };
  });
}

var ForemanProfileAPI = {
  SESSION_KEY: SESSION_KEY,
  NETWORK_DELAY: NETWORK_DELAY,
  register: register,
  login: login,
  getCurrentUser: getCurrentUser,
  updateProfile: updateProfile,
  logout: logout
};

if (typeof window !== 'undefined') {
  window.ForemanProfileAPI = ForemanProfileAPI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanProfileAPI;
}

})();
