(function() {
// Foreman Messages UI — DOM controller that renders the message composer and
// inbox, wiring them to ForemanMessagesAPI. All user-supplied text is rendered
// with textContent / createTextNode to prevent XSS.

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

function renderMessages(container) {
  if (!container) return;
  var api = getAPI();
  var chatControls = null;

  function renderSignedOut() {
    container.dataset.userId = '';
    container._activeChatId = null;
    container._refreshInbox = null;
    container._refreshChatList = null;
    container._refreshActiveThread = null;

    container.innerHTML = '';
    container.appendChild(el('h2', 'messages-list-title', 'Messages'));
    container.appendChild(el('div', 'messages-empty', 'Sign in on the Profile tab to send and read messages.'));
  }

  function renderInbox() {
    var inbox = container.querySelector('.messages-inbox');
    var list;
    if (!inbox) {
      inbox = el('div', 'messages-inbox');
      inbox.appendChild(el('h2', 'messages-inbox-title', 'Inbox'));
      list = el('div', 'messages-thread');
      inbox.appendChild(list);
      container.appendChild(inbox);
    } else {
      list = inbox.querySelector('.messages-thread');
    }

    function refreshInbox() {
      return api.inbox().then(function(messages) {
        list.innerHTML = '';
        if (!messages || messages.length === 0) {
          list.appendChild(el('p', 'messages-empty', 'No messages yet.'));
          return;
        }
        for (var i = 0; i < messages.length; i++) {
          var msg = messages[i];
          var item = el('div', 'message-item');

          var meta = el('div', 'message-meta');
          meta.appendChild(el('span', 'message-from', 'From: '));
          // username rendered via text node — never innerHTML (XSS-safe)
          meta.appendChild(document.createTextNode(msg.fromUsername == null ? '' : String(msg.fromUsername)));
          meta.appendChild(el('span', 'message-time', formatDate(msg.createdAt)));

          var bodyDiv = el('div', 'message-body');
          // body rendered via text node — never innerHTML (XSS-safe)
          bodyDiv.appendChild(document.createTextNode(msg.body == null ? '' : String(msg.body)));

          item.appendChild(meta);
          item.appendChild(bodyDiv);
          list.appendChild(item);
        }
      }).catch(function() {
        list.innerHTML = '';
        list.appendChild(el('p', 'messages-empty', 'Could not load messages.'));
      });
    }

    container._refreshInbox = refreshInbox;
    refreshInbox();
  }

  function renderComposer(me) {
    var form = el('form', 'messages-form');
    form.appendChild(el('h2', 'messages-form-title', 'New Message'));

    var select = el('select', 'messages-input');
    select.name = 'recipient';
    select.setAttribute('aria-label', 'Recipient');
    var defaultOption = el('option', null, 'Select a recipient');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    var bodyEl = el('textarea', 'messages-input messages-body');
    bodyEl.name = 'body';
    bodyEl.placeholder = 'Write your message...';
    bodyEl.setAttribute('aria-label', 'Message body');

    var submit = el('button', 'messages-btn', 'Send');
    submit.type = 'submit';

    form.appendChild(select);
    form.appendChild(bodyEl);
    form.appendChild(submit);
    container.appendChild(form);

    api.listRecipients().then(function(users) {
      if (!users || users.length === 0) {
        submit.disabled = true;
        form.appendChild(el('p', 'messages-empty', 'No other users to message yet.'));
        showBanner(form, 'error', 'No other users to message yet.');
        return;
      }
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var opt = el('option');
        opt.value = user.id;
        // username rendered via text node (XSS-safe)
        opt.appendChild(document.createTextNode(user.username == null ? '' : String(user.username)));
        select.appendChild(opt);
      }
    }).catch(function() {
      submit.disabled = true;
      showBanner(form, 'error', 'Could not load recipients.');
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var toId = select.value;
      var body = bodyEl.value.trim();
      if (!toId) {
        showBanner(form, 'error', 'Please choose a recipient.');
        return;
      }
      if (!body) {
        showBanner(form, 'error', 'Message body is required.');
        return;
      }
      var toUsername = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : '';
      setLoading(form, true);
      api.send(toId, toUsername, body).then(function(record) {
        setLoading(form, false);
        bodyEl.value = '';
        showBanner(form, 'success', 'Message sent.');
        renderInbox();
        if (chatControls) {
          chatControls.refresh();
          if (record && record.chatId) chatControls.open(record.chatId);
        }
      }).catch(function(err) {
        setLoading(form, false);
        showBanner(form, 'error', err.message);
      });
    });
  }

  function renderChatSection(me) {
    var wrapper = el('div', 'chats-section');
    wrapper.appendChild(el('h2', 'chats-title', 'Chats'));

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
              openActiveChat(chat.id);
            });
            chatList.appendChild(item);
          })(chats[i]);
        }
      }).catch(function() {
        chatList.innerHTML = '';
        chatList.appendChild(el('p', 'messages-empty', 'Could not load chats.'));
      });
    }

    function openActiveChat(chatId) {
      container._activeChatId = chatId;
      activePane.innerHTML = '';
      var thread = el('div', 'chat-thread');
      activePane.appendChild(thread);

      function renderThread() {
        return api.chatMessages(chatId).then(function(msgs) {
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
        });
      }

      container._refreshActiveThread = renderThread;

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

    wrapper.appendChild(groupForm);
    wrapper.appendChild(chatList);
    wrapper.appendChild(activePane);
    container.appendChild(wrapper);

    container._refreshChatList = refreshChatList;
    chatControls = { refresh: refreshChatList, open: openActiveChat };
    refreshChatList();
  }

  api.getCurrentUser().then(function(me) {
    if (!me) {
      renderSignedOut();
      return;
    }

    var lastUserId = container.dataset.userId || '';
    var currentUserId = String(me.id);

    if (currentUserId !== lastUserId || !container.querySelector('.messages-form')) {
      container.innerHTML = '';
      container.dataset.userId = currentUserId;
      container._activeChatId = null;
      container._refreshInbox = null;
      container._refreshChatList = null;
      container._refreshActiveThread = null;

      container.appendChild(el('h2', 'messages-list-title', 'Messages'));

      renderComposer(me);
      renderInbox();
      renderChatSection(me);
    } else {
      if (typeof container._refreshInbox === 'function') {
        container._refreshInbox();
      }
      if (typeof container._refreshChatList === 'function') {
        container._refreshChatList();
      }
      if (container._activeChatId && typeof container._refreshActiveThread === 'function') {
        container._refreshActiveThread().catch(function() {});
      }
    }
  }).catch(renderSignedOut);
}

var ForemanMessagesUI = {
  renderMessages: renderMessages
};

if (typeof window !== 'undefined') {
  window.ForemanMessagesUI = ForemanMessagesUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanMessagesUI;
}

})();
