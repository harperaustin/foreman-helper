(function() {
// Foreman Messages DB — simulated persistence layer backed by localStorage.
// Stores user-to-user messages and provides pure-JS, synchronous CRUD helpers.

var STORAGE_KEY = 'foreman_messages';
var CHATS_KEY = 'foreman_chats';

function generateId() {
  var hex = '';
  for (var i = 0; i < 8; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return 'msg_' + hex;
}

function generateChatId() {
  var hex = '';
  for (var i = 0; i < 8; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return 'chat_' + hex;
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

function sendMessage(fromId, fromUsername, toId, toUsername, body, chatId) {
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
    chatId: chatId || null,
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

// ===== Chat store =====

function loadChats() {
  try {
    var raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

function normalizeParticipants(ids) {
  if (!Array.isArray(ids)) return [];
  var seen = {};
  var result = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (!id) continue;
    if (seen[id]) continue;
    seen[id] = true;
    result.push(id);
  }
  return result.slice().sort();
}

function participantsKey(ids) {
  return normalizeParticipants(ids).join('|');
}

function findChatByParticipants(ids) {
  var key = participantsKey(ids);
  var chats = loadChats();
  for (var i = 0; i < chats.length; i++) {
    var c = chats[i];
    if (c && participantsKey(c.participants) === key) return c;
  }
  return null;
}

function getOrCreateChat(ids) {
  var norm = normalizeParticipants(ids);
  if (norm.length < 2) {
    throw new Error('A chat needs at least two participants.');
  }
  var existing = findChatByParticipants(norm);
  if (existing) return existing;
  var record = {
    id: generateChatId(),
    participants: norm,
    isGroup: norm.length > 2,
    createdAt: new Date().toISOString()
  };
  var chats = loadChats();
  chats.push(record);
  saveChats(chats);
  return record;
}

function getChat(chatId) {
  var chats = loadChats();
  for (var i = 0; i < chats.length; i++) {
    if (chats[i] && chats[i].id === chatId) return chats[i];
  }
  return null;
}

function backfillDirectChats(userId) {
  if (!userId) return;
  var messages = loadMessages();
  var partners = {};
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (!m || m.chatId) continue;
    if (!m.fromId || !m.toId || m.fromId === m.toId) continue;
    var partner = null;
    if (m.fromId === userId) partner = m.toId;
    else if (m.toId === userId) partner = m.fromId;
    if (partner) partners[partner] = true;
  }
  for (var p in partners) {
    if (partners.hasOwnProperty(p)) {
      getOrCreateChat([userId, p]);
    }
  }
}

function listChats(userId) {
  backfillDirectChats(userId);
  var chats = loadChats();
  var result = [];
  for (var i = 0; i < chats.length; i++) {
    var c = chats[i];
    if (c && Array.isArray(c.participants) && c.participants.indexOf(userId) >= 0) {
      result.push(c);
    }
  }
  return result;
}

function getChatMessages(chatId) {
  var chat = getChat(chatId);
  if (!chat) return [];
  var messages = loadMessages();
  var result = [];
  var seen = {};
  var i, m;
  for (i = 0; i < messages.length; i++) {
    m = messages[i];
    if (m && m.chatId === chatId) {
      result.push(m);
      seen[m.id] = true;
    }
  }
  var isDirect = !chat.isGroup && Array.isArray(chat.participants) && chat.participants.length === 2;
  if (isDirect) {
    var a = chat.participants[0];
    var b = chat.participants[1];
    for (i = 0; i < messages.length; i++) {
      m = messages[i];
      if (!m || m.chatId) continue;
      if (seen[m.id]) continue;
      if ((m.fromId === a && m.toId === b) || (m.fromId === b && m.toId === a)) {
        result.push(m);
        seen[m.id] = true;
      }
    }
  }
  result.sort(function(x, y) {
    if (x.createdAt === y.createdAt) return 0;
    return x.createdAt > y.createdAt ? 1 : -1;
  });
  return result;
}

function postChatMessage(chatId, fromId, fromUsername, body) {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new Error('Message body is required.');
  }
  if (body.trim().length > 2000) {
    throw new Error('Message must be 2000 characters or fewer.');
  }
  if (!fromId) throw new Error('Sender is required.');
  var chat = getChat(chatId);
  if (!chat) throw new Error('Chat not found.');
  if (!Array.isArray(chat.participants) || chat.participants.indexOf(fromId) < 0) {
    throw new Error('You are not a participant in this chat.');
  }

  // Direct chats keep the other participant as recipient so replies still
  // surface in the legacy inbox/sent views; true group chats use no single
  // recipient.
  var toId = '';
  var toUsername = '';
  if (!chat.isGroup && chat.participants.length === 2) {
    toId = chat.participants[0] === fromId ? chat.participants[1] : chat.participants[0];
  }

  var record = {
    id: generateId(),
    chatId: chat.id,
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

function clearAllChats() {
  localStorage.removeItem(CHATS_KEY);
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
  clearAllMessages: clearAllMessages,
  CHATS_KEY: CHATS_KEY,
  generateChatId: generateChatId,
  loadChats: loadChats,
  saveChats: saveChats,
  normalizeParticipants: normalizeParticipants,
  participantsKey: participantsKey,
  findChatByParticipants: findChatByParticipants,
  getOrCreateChat: getOrCreateChat,
  getChat: getChat,
  backfillDirectChats: backfillDirectChats,
  listChats: listChats,
  getChatMessages: getChatMessages,
  postChatMessage: postChatMessage,
  clearAllChats: clearAllChats
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesDB = ForemanMessagesDB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesDB;
}

})();
