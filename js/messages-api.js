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
      var chat = db.getOrCreateChat([me.id, cleanToId]);
      return db.sendMessage(me.id, me.username, cleanToId, cleanToUsername, cleanBody, chat.id);
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

function resolveUsernames(ids, users, me) {
  var map = {};
  if (me && me.id) map[me.id] = me.username;
  if (Array.isArray(users)) {
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u && u.id) map[u.id] = u.username;
    }
  }
  return map;
}

function enrichChat(chat, nameMap, db) {
  var participantUsernames = [];
  for (var i = 0; i < chat.participants.length; i++) {
    var pid = chat.participants[i];
    participantUsernames.push(nameMap[pid] != null ? nameMap[pid] : pid);
  }
  var msgs = db.getChatMessages(chat.id);
  var last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
  return {
    id: chat.id,
    participants: chat.participants,
    isGroup: chat.isGroup,
    participantUsernames: participantUsernames,
    lastMessage: last
  };
}

function listChats() {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    if (!me || !me.id) {
      throw new Error('You must be signed in to view chats.');
    }
    return profile.listUsers().then(function(users) {
      return delay(function() {
        var db = getDB();
        var nameMap = resolveUsernames(null, users, me);
        var chats = db.listChats(me.id);
        var result = [];
        for (var i = 0; i < chats.length; i++) {
          result.push(enrichChat(chats[i], nameMap, db));
        }
        return result;
      });
    });
  });
}

function openChat(participantIds) {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    if (!me || !me.id) {
      throw new Error('You must be signed in to open a chat.');
    }
    return profile.listUsers().then(function(users) {
      return delay(function() {
        var db = getDB();
        var validIds = {};
        if (Array.isArray(users)) {
          for (var i = 0; i < users.length; i++) {
            if (users[i] && users[i].id) validIds[users[i].id] = true;
          }
        }
        validIds[me.id] = true;
        var others = Array.isArray(participantIds) ? participantIds : [];
        var set = [me.id];
        var seenOther = {};
        for (var j = 0; j < others.length; j++) {
          var oid = sanitize(others[j]);
          if (!oid || oid === me.id) continue;
          if (!validIds[oid]) throw new Error('Unknown participant.');
          if (seenOther[oid]) continue;
          seenOther[oid] = true;
          set.push(oid);
        }
        if (set.length < 2) {
          throw new Error('Choose at least one other participant.');
        }
        var chat = db.getOrCreateChat(set);
        var nameMap = resolveUsernames(null, users, me);
        return enrichChat(chat, nameMap, db);
      });
    });
  });
}

function openDirectChat(otherId) {
  var cleanId = sanitize(otherId);
  if (!cleanId) {
    return Promise.reject(new Error('Choose at least one other participant.'));
  }
  return openChat([cleanId]);
}

function createGroupChat(otherIds) {
  if (!Array.isArray(otherIds) || otherIds.length < 2) {
    return Promise.reject(new Error('A group chat needs at least two other people.'));
  }
  return openChat(otherIds);
}

function chatMessages(chatId) {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return delay(function() {
      if (!me || !me.id) {
        throw new Error('You must be signed in to view chats.');
      }
      var db = getDB();
      var cleanId = sanitize(chatId);
      var chat = db.getChat(cleanId);
      if (!chat) throw new Error('Chat not found.');
      if (chat.participants.indexOf(me.id) < 0) {
        throw new Error('You are not a participant in this chat.');
      }
      return db.getChatMessages(cleanId);
    });
  });
}

function sendToChat(chatId, body) {
  var profile = getProfileAPI();
  return profile.getCurrentUser().then(function(me) {
    return delay(function() {
      if (!me || !me.id) {
        throw new Error('You must be signed in to send messages.');
      }
      var db = getDB();
      var cleanBody = sanitize(body);
      var cleanChatId = sanitize(chatId);
      if (!cleanBody) throw new Error('Message body is required.');
      var chat = db.getChat(cleanChatId);
      if (!chat) throw new Error('Chat not found.');
      if (chat.participants.indexOf(me.id) < 0) {
        throw new Error('You are not a participant in this chat.');
      }
      return db.postChatMessage(cleanChatId, me.id, me.username, cleanBody);
    });
  });
}

var ForemanMessagesAPI = {
  NETWORK_DELAY: NETWORK_DELAY,
  send: send,
  inbox: inbox,
  sent: sent,
  listRecipients: listRecipients,
  getCurrentUser: getCurrentUser,
  listChats: listChats,
  openChat: openChat,
  openDirectChat: openDirectChat,
  createGroupChat: createGroupChat,
  chatMessages: chatMessages,
  sendToChat: sendToChat
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesAPI = ForemanMessagesAPI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesAPI;
}

})();
