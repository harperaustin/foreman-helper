(function() {
// Foreman Messages DB — simulated persistence layer backed by localStorage.
// Stores user-to-user messages and provides pure-JS, synchronous CRUD helpers.

var STORAGE_KEY = 'foreman_messages';

function generateId() {
  var hex = '';
  for (var i = 0; i < 8; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return 'msg_' + hex;
}

function loadMessages() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function sendMessage(fromId, fromUsername, toId, toUsername, body) {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new Error('Message body is required.');
  }
  if (body.trim().length > 2000) {
    throw new Error('Message must be 2000 characters or fewer.');
  }
  if (!fromId) throw new Error('Sender is required.');
  if (!toId) throw new Error('Recipient is required.');
  if (fromId === toId) throw new Error('You cannot message yourself.');

  var record = {
    id: generateId(),
    fromId: fromId,
    fromUsername: fromUsername,
    toId: toId,
    toUsername: toUsername,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    read: false
  };
  var messages = loadMessages();
  messages.push(record);
  saveMessages(messages);
  return record;
}

function getInbox(userId) {
  var messages = loadMessages();
  var result = [];
  for (var i = 0; i < messages.length; i++) {
    if (messages[i] && messages[i].toId === userId) result.push(messages[i]);
  }
  result.sort(function(a, b) {
    return a.createdAt < b.createdAt ? 1 : -1;
  });
  return result;
}

function getSent(userId) {
  var messages = loadMessages();
  var result = [];
  for (var i = 0; i < messages.length; i++) {
    if (messages[i] && messages[i].fromId === userId) result.push(messages[i]);
  }
  result.sort(function(a, b) {
    return a.createdAt < b.createdAt ? 1 : -1;
  });
  return result;
}

function getConversation(userA, userB) {
  var messages = loadMessages();
  var result = [];
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (!m) continue;
    if ((m.fromId === userA && m.toId === userB) ||
        (m.fromId === userB && m.toId === userA)) {
      result.push(m);
    }
  }
  result.sort(function(a, b) {
    return a.createdAt > b.createdAt ? 1 : -1;
  });
  return result;
}

function markRead(id) {
  var messages = loadMessages();
  for (var i = 0; i < messages.length; i++) {
    if (messages[i] && messages[i].id === id) {
      messages[i].read = true;
      saveMessages(messages);
      return messages[i];
    }
  }
  return null;
}

function clearAllMessages() {
  localStorage.removeItem(STORAGE_KEY);
}

var ForemanMessagesDB = {
  STORAGE_KEY: STORAGE_KEY,
  generateId: generateId,
  loadMessages: loadMessages,
  saveMessages: saveMessages,
  sendMessage: sendMessage,
  getInbox: getInbox,
  getSent: getSent,
  getConversation: getConversation,
  markRead: markRead,
  clearAllMessages: clearAllMessages
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesDB = ForemanMessagesDB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesDB;
}

})();
