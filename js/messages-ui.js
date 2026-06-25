(function() {
// Foreman Messages UI — DOM controller that renders the Chats messaging
// surface (chat list, open thread + reply form) and a new-conversation
// starter, wiring them to ForemanMessagesAPI. All user-supplied text is
// rendered with textContent / createTextNode to prevent XSS.

function getAPI() {
  if (typeof window !== 'undefined' && window.ForemanMessagesAPI) {
    return window.ForemanMessagesAPI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    return require('./messages-api.js');
  }
  return null;
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof text !== 'undefined') node.textContent = text;
  return node;
}

function showBanner(form, type, message) {
  var existing = form.querySelector('.error-banner, .success-banner');
  if (existing) existing.parentNode.removeChild(existing);
  var banner = el('div', type === 'error' ? 'error-banner' : 'success-banner', message);
  banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
  form.insertBefore(banner, form.firstChild);
}

function setLoading(form, loading, label) {
  var controls = form.querySelectorAll('input, button, textarea, select');
  for (var i = 0; i < controls.length; i++) {
    controls[i].disabled = loading;
  }
  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    if (loading) {
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = 'Processing...';
    } else if (submitBtn.dataset.label) {
      submitBtn.textContent = submitBtn.dataset.label;
    } else if (label) {
      submitBtn.textContent = label;
    }
  }
}

function formatDate(iso) {
  if (!iso) return 'unknown';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  return d.toLocaleString();
}

// Module-level builder: (re)fill an open chat thread. Only rebuilds the
// message list — never the reply textarea. Structure/classes kept identical.
function fillChatThread(thread, msgs, me) {
  thread.innerHTML = '';
  if (!msgs || msgs.length === 0) {
    thread.appendChild(el('p', 'messages-empty', 'No messages yet.'));
    return;
  }
  for (var i = 0; i < msgs.length; i++) {
    var msg = msgs[i];
    var item = el('div', 'message-item ' + (msg.fromId === me.id ? 'chat-msg-own' : 'chat-msg-other'));
    var meta = el('div', 'message-meta');
    meta.appendChild(document.createTextNode(msg.fromUsername == null ? '' : String(msg.fromUsername)));
    meta.appendChild(el('span', 'message-time', formatDate(msg.createdAt)));
    var bodyDiv = el('div', 'message-body');
    bodyDiv.appendChild(document.createTextNode(msg.body == null ? '' : String(msg.body)));
    item.appendChild(meta);
    item.appendChild(bodyDiv);
    thread.appendChild(item);
  }
}

// Module-level builder: (re)fill the chat list (buttons/previews only — no user
// input), wiring each item to onOpen(chatId). Reused by the full render and the
// incremental poll refresh so newly created chats / updated previews surface live.
function fillChatList(chatList, chats, me, onOpen) {
  chatList.innerHTML = '';
  if (!chats || chats.length === 0) {
    chatList.appendChild(el('p', 'messages-empty', 'No chats yet.'));
    return;
  }
  for (var i = 0; i < chats.length; i++) {
    (function(chat) {
      var item = el('button', 'chat-list-item');
      item.type = 'button';
      item.dataset.chatId = chat.id;
      var others = [];
      for (var j = 0; j < chat.participantUsernames.length; j++) {
        if (chat.participants[j] !== me.id) {
          others.push(chat.participantUsernames[j]);
        }
      }
      var label = (chat.isGroup ? '\uD83D\uDC65 ' : '') + others.join(', ');
      var labelEl = el('span', 'chat-list-label');
      labelEl.appendChild(document.createTextNode(label));
      item.appendChild(labelEl);
      if (chat.lastMessage && chat.lastMessage.body) {
        var preview = el('span', 'chat-list-preview');
        preview.appendChild(document.createTextNode(String(chat.lastMessage.body)));
        item.appendChild(preview);
      }
      item.addEventListener('click', function() {
        onOpen(chat.id);
      });
      chatList.appendChild(item);
    })(chats[i]);
  }
}

function renderMessages(container) {
  if (!container) return;
  var api = getAPI();

  container.innerHTML = '';
  container.appendChild(el('h2', 'messages-list-title', 'Messages'));

  function renderSignedOut() {
    container.innerHTML = '';
    container.appendChild(el('h2', 'messages-list-title', 'Messages'));
    container.appendChild(el('div', 'messages-empty', 'Sign in on the Profile tab to send and read messages.'));
  }

  function renderChatSection(me) {
    var wrapper = el('div', 'chats-section');
    wrapper.appendChild(el('h2', 'chats-title', 'Chats'));

    // ---- New direct conversation starter (non-sending) ----
    var newChatForm = el('form', 'new-chat-form');
    newChatForm.appendChild(el('h2', 'new-chat-title', 'New conversation'));
    var newChatSelect = el('select', 'new-chat-select');
    newChatSelect.setAttribute('aria-label', 'Recipient');
    var ncDefault = el('option', null, 'Select a recipient');
    ncDefault.value = '';
    ncDefault.disabled = true;
    ncDefault.selected = true;
    newChatSelect.appendChild(ncDefault);
    var newChatBtn = el('button', 'new-chat-btn', 'Start chat');
    newChatBtn.type = 'submit';
    newChatForm.appendChild(newChatSelect);
    newChatForm.appendChild(newChatBtn);

    api.listRecipients().then(function(users) {
      if (!users || users.length === 0) {
        newChatBtn.disabled = true;
        newChatForm.appendChild(el('p', 'messages-empty', 'No other users to message yet.'));
        showBanner(newChatForm, 'error', 'No other users to message yet.');
        return;
      }
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var opt = el('option');
        opt.value = user.id;
        // username rendered via text node (XSS-safe)
        opt.appendChild(document.createTextNode(user.username == null ? '' : String(user.username)));
        newChatSelect.appendChild(opt);
      }
    }).catch(function() {
      newChatBtn.disabled = true;
      showBanner(newChatForm, 'error', 'Could not load recipients.');
    });

    newChatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var toId = newChatSelect.value;
      if (!toId) {
        showBanner(newChatForm, 'error', 'Please choose a recipient.');
        return;
      }
      setLoading(newChatForm, true);
      api.openDirectChat(toId).then(function(chat) {
        setLoading(newChatForm, false);
        showBanner(newChatForm, 'success', 'Conversation ready.');
        refreshChatList();
        openActiveChat(chat.id);
      }).catch(function(err) {
        setLoading(newChatForm, false);
        showBanner(newChatForm, 'error', err.message);
      });
    });

    // ---- Group create form ----
    var groupForm = el('form', 'chat-group-form');
    groupForm.appendChild(el('h2', 'chat-group-title', 'New Group Chat'));
    var groupSelect = el('select', 'chat-group-select');
    groupSelect.setAttribute('multiple', 'multiple');
    groupSelect.setAttribute('aria-label', 'Group participants');
    var groupBtn = el('button', 'chat-group-btn', 'Create group chat');
    groupBtn.type = 'submit';
    groupForm.appendChild(groupSelect);
    groupForm.appendChild(groupBtn);

    api.listRecipients().then(function(users) {
      if (!users) return;
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var opt = el('option');
        opt.value = user.id;
        opt.appendChild(document.createTextNode(user.username == null ? '' : String(user.username)));
        groupSelect.appendChild(opt);
      }
    }).catch(function() {});

    groupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var ids = [];
      for (var i = 0; i < groupSelect.options.length; i++) {
        if (groupSelect.options[i].selected) ids.push(groupSelect.options[i].value);
      }
      if (ids.length < 2) {
        showBanner(groupForm, 'error', 'Select at least two people for a group chat.');
        return;
      }
      setLoading(groupForm, true);
      api.createGroupChat(ids).then(function(chat) {
        setLoading(groupForm, false);
        showBanner(groupForm, 'success', 'Group chat ready.');
        refreshChatList();
        openActiveChat(chat.id);
      }).catch(function(err) {
        setLoading(groupForm, false);
        showBanner(groupForm, 'error', err.message);
      });
    });

    // ---- Chat list ----
    var chatList = el('div', 'chat-list');

    // ---- Active chat pane ----
    var activePane = el('div', 'chat-active');
    activePane.appendChild(el('p', 'messages-empty', 'Select a chat to view its history.'));

    function refreshChatList() {
      api.listChats().then(function(chats) {
        fillChatList(chatList, chats, me, openActiveChat);
      }).catch(function() {
        chatList.innerHTML = '';
        chatList.appendChild(el('p', 'messages-empty', 'Could not load chats.'));
      });
    }

    function openActiveChat(chatId) {
      activePane.innerHTML = '';
      activePane.dataset.chatId = String(chatId);
      var thread = el('div', 'chat-thread');
      activePane.appendChild(thread);

      function renderThread() {
        return api.chatMessages(chatId).then(function(msgs) {
          fillChatThread(thread, msgs, me);
        });
      }

      renderThread().catch(function(err) {
        showBanner(activePane, 'error', err.message);
      });

      var replyForm = el('form', 'chat-reply-form');
      var replyInput = el('textarea', 'chat-reply-input');
      replyInput.setAttribute('aria-label', 'Reply');
      replyInput.placeholder = 'Write a reply...';
      var replyBtn = el('button', 'chat-reply-btn', 'Send');
      replyBtn.type = 'submit';
      replyForm.appendChild(replyInput);
      replyForm.appendChild(replyBtn);
      activePane.appendChild(replyForm);

      replyForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var body = replyInput.value.trim();
        if (!body) {
          showBanner(replyForm, 'error', 'Message body is required.');
          return;
        }
        setLoading(replyForm, true);
        api.sendToChat(chatId, body).then(function() {
          setLoading(replyForm, false);
          replyInput.value = '';
          showBanner(replyForm, 'success', 'Message sent.');
          renderThread();
          refreshChatList();
        }).catch(function(err) {
          setLoading(replyForm, false);
          showBanner(replyForm, 'error', err.message);
        });
      });
    }

    wrapper.appendChild(newChatForm);
    wrapper.appendChild(groupForm);
    wrapper.appendChild(chatList);
    wrapper.appendChild(activePane);
    container.appendChild(wrapper);

    // Expose the open handler on the container so the non-destructive poll
    // refresh (updateInbox) can rebuild the chat list with working click
    // handlers without re-rendering the whole section.
    container.__foremanChatControls = { open: openActiveChat };
    refreshChatList();
  }

  api.getCurrentUser().then(function(me) {
    if (!me) {
      renderSignedOut();
      return;
    }
    renderChatSection(me);
  }).catch(renderSignedOut);
}

// Non-destructive poll refresh: re-fetches data and rebuilds ONLY the open chat
// thread and the chat list (buttons/previews) in place. It deliberately never
// touches the new-chat <select>, the group form, or the open .chat-reply-input
// textarea — preserving any in-progress typed text and avoiding scroll jumps on
// each poll.
function updateInbox(container) {
  if (!container) return;                       // null-safe (mirrors renderMessages)
  var api = getAPI();
  if (!api) return;
  var chatList = container.querySelector('.chat-list');
  // If the panel isn't in a signed-in rendered state yet, fall back to a full render.
  if (!chatList) { renderMessages(container); return; }
  api.getCurrentUser().then(function(me) {
    if (!me) { renderMessages(container); return; } // signed out → show prompt
    // 1) Chat list (buttons/previews only) — rebuild in place so new chats /
    //    updated last-message previews surface live. Reuses the open handler
    //    captured at full-render time so clicks still open the active pane.
    var controls = container.__foremanChatControls;
    if (controls && typeof controls.open === 'function') {
      api.listChats().then(function(chats) {
        fillChatList(chatList, chats, me, controls.open);
      }).catch(function() {});
    }
    // 2) Open chat thread (if any) — rebuild ONLY .chat-thread, leaving the
    //    reply textarea (and its in-progress draft) fully intact.
    var active = container.querySelector('.chat-active');
    if (active && active.dataset && active.dataset.chatId) {
      var thread = active.querySelector('.chat-thread');
      if (thread) {
        api.chatMessages(active.dataset.chatId).then(function(msgs) {
          fillChatThread(thread, msgs, me);
        }).catch(function() {});
      }
    }
  }).catch(function() {});
}

var ForemanMessagesUI = {
  renderMessages: renderMessages,
  updateInbox: updateInbox
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesUI = ForemanMessagesUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesUI;
}

})();
