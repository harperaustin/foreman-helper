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

  container.innerHTML = '';
  container.appendChild(el('h2', 'messages-list-title', 'Messages'));

  function renderSignedOut() {
    container.innerHTML = '';
    container.appendChild(el('h2', 'messages-list-title', 'Messages'));
    container.appendChild(el('div', 'messages-empty', 'Sign in on the Profile tab to send and read messages.'));
  }

  function renderInbox() {
    var prior = container.querySelector('.messages-inbox');
    if (prior) prior.parentNode.removeChild(prior);

    var inbox = el('div', 'messages-inbox');
    inbox.appendChild(el('h2', 'messages-inbox-title', 'Inbox'));
    var list = el('div', 'messages-thread');
    inbox.appendChild(list);
    container.appendChild(inbox);

    api.inbox().then(function(messages) {
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
      api.send(toId, toUsername, body).then(function() {
        setLoading(form, false);
        bodyEl.value = '';
        showBanner(form, 'success', 'Message sent.');
        renderInbox();
      }).catch(function(err) {
        setLoading(form, false);
        showBanner(form, 'error', err.message);
      });
    });
  }

  api.getCurrentUser().then(function(me) {
    if (!me) {
      renderSignedOut();
      return;
    }
    renderComposer(me);
    renderInbox();
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
