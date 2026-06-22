(function() {
// Foreman Profile DB — simulated persistence layer backed by localStorage.
// Provides pure-JS SHA-256 hashing, salted password storage, validation, and
// CRUD helpers for user profiles.

var STORAGE_KEY = 'foreman_users';

// --- Pure JavaScript SHA-256 implementation ---
function sha256(ascii) {
  ascii = String(ascii);
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var result = '';

  var words = [];
  var asciiBitLength = ascii.length * 8;

  var hash = sha256.h = sha256.h || [];
  var k = sha256.k = sha256.k || [];
  var primeCounter = k.length;

  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (var i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    var j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    var w = words.slice(j, (j += 16));
    var oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15];
      var w2 = w[i - 2];

      var a = hash[0];
      var e = hash[4];
      var temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      var temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function generateSalt() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var salt = '';
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

function generateId() {
  var hex = '';
  for (var i = 0; i < 8; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return 'usr_' + hex;
}

// --- Validation ---
function validateUsername(username) {
  if (typeof username !== 'string') return 'Username is required.';
  if (username.length < 3 || username.length > 15) {
    return 'Username must be 3-15 characters.';
  }
  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    return 'Username may only contain letters, numbers, and underscores.';
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

// --- Storage helpers ---
function loadUsers() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getUser(id) {
  var users = loadUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === id) return users[i];
  }
  return null;
}

function getUserByUsername(username) {
  if (typeof username !== 'string') return null;
  var target = username.toLowerCase();
  var users = loadUsers();
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).toLowerCase() === target) return users[i];
  }
  return null;
}

var VALID_AVATARS = ['classic', 'colorful', 'light'];

function isValidAvatar(avatar) {
  for (var i = 0; i < VALID_AVATARS.length; i++) {
    if (VALID_AVATARS[i] === avatar) return true;
  }
  return false;
}

function createUser(username, password, avatar) {
  var usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  var passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  if (typeof avatar === 'undefined') avatar = 'classic';
  if (!isValidAvatar(avatar)) {
    throw new Error('Invalid avatar selection.');
  }

  if (getUserByUsername(username)) {
    throw new Error('Username already taken.');
  }

  var users = loadUsers();
  var salt = generateSalt();
  var now = new Date().toISOString();
  var user = {
    id: generateId(),
    username: username,
    salt: salt,
    passwordHash: sha256(password + salt),
    avatar: avatar,
    createdAt: now,
    updatedAt: now
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function updateUser(id, updates) {
  updates = updates || {};
  var users = loadUsers();
  var index = -1;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      index = i;
      break;
    }
  }
  if (index === -1) throw new Error('User not found.');

  var user = users[index];

  if (typeof updates.username !== 'undefined') {
    var usernameError = validateUsername(updates.username);
    if (usernameError) throw new Error(usernameError);
    var existing = getUserByUsername(updates.username);
    if (existing && existing.id !== id) {
      throw new Error('Username already taken.');
    }
    user.username = updates.username;
  }

  if (typeof updates.password !== 'undefined') {
    var passwordError = validatePassword(updates.password);
    if (passwordError) throw new Error(passwordError);
    user.salt = generateSalt();
    user.passwordHash = sha256(updates.password + user.salt);
  }

  if (typeof updates.avatar !== 'undefined') {
    if (!isValidAvatar(updates.avatar)) {
      throw new Error('Invalid avatar selection.');
    }
    user.avatar = updates.avatar;
  }

  user.updatedAt = new Date().toISOString();
  users[index] = user;
  saveUsers(users);
  return user;
}

function verifyCredentials(username, password) {
  var user = getUserByUsername(username);
  if (!user) return null;
  if (typeof password !== 'string') return null;
  var hash = sha256(password + user.salt);
  return hash === user.passwordHash ? user : null;
}

function clearAllUsers() {
  localStorage.removeItem(STORAGE_KEY);
}

var ForemanProfileDB = {
  STORAGE_KEY: STORAGE_KEY,
  sha256: sha256,
  generateSalt: generateSalt,
  generateId: generateId,
  validateUsername: validateUsername,
  validatePassword: validatePassword,
  createUser: createUser,
  getUser: getUser,
  getUserByUsername: getUserByUsername,
  updateUser: updateUser,
  verifyCredentials: verifyCredentials,
  clearAllUsers: clearAllUsers
};

if (typeof window !== 'undefined') {
  window.ForemanProfileDB = ForemanProfileDB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanProfileDB;
}

})();
