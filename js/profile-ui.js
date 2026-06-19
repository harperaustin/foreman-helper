(function() {
// Foreman Profile UI — DOM controller that renders login, register, profile,
// and edit views, wiring them to ForemanProfileAPI. All user-supplied text is
// rendered with textContent to prevent XSS.

function getAPI() {
  if (typeof window !== 'undefined' && window.ForemanProfileAPI) {
    return window.ForemanProfileAPI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    return require('./profile-api.js');
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
  var controls = form.querySelectorAll('input, button');
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
  return d.toLocaleDateString();
}

function renderProfile(container) {
  if (!container) return;
  var api = getAPI();

  function clear() {
    container.innerHTML = '';
  }

  function renderLogin() {
    clear();
    var form = el('form', 'profile-form');
    form.appendChild(el('h2', 'profile-form-title', 'Sign In'));

    var username = el('input', 'profile-input');
    username.type = 'text';
    username.name = 'username';
    username.placeholder = 'Username';
    username.setAttribute('aria-label', 'Username');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'Password';
    password.setAttribute('aria-label', 'Password');

    var submit = el('button', 'profile-btn', 'Sign In');
    submit.type = 'submit';

    var registerLink = el('button', 'profile-link', 'Register');
    registerLink.type = 'button';
    registerLink.addEventListener('click', renderRegister);

    form.appendChild(username);
    form.appendChild(password);
    form.appendChild(submit);
    form.appendChild(registerLink);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var u = username.value.trim();
      var p = password.value.trim();
      if (!u || !p) {
        showBanner(form, 'error', 'Please enter a username and password.');
        return;
      }
      setLoading(form, true);
      api.login(u, p).then(function() {
        renderView();
      }).catch(function(err) {
        setLoading(form, false);
        showBanner(form, 'error', err.message);
      });
    });

    container.appendChild(form);
  }

  function renderRegister() {
    clear();
    var form = el('form', 'profile-form');
    form.appendChild(el('h2', 'profile-form-title', 'Create Account'));

    var username = el('input', 'profile-input');
    username.type = 'text';
    username.name = 'username';
    username.placeholder = 'Username (3-15 chars)';
    username.setAttribute('aria-label', 'Username');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'Password';
    password.setAttribute('aria-label', 'Password');

    var confirm = el('input', 'profile-input');
    confirm.type = 'password';
    confirm.name = 'confirm';
    confirm.placeholder = 'Confirm Password';
    confirm.setAttribute('aria-label', 'Confirm Password');

    var submit = el('button', 'profile-btn', 'Register');
    submit.type = 'submit';

    var backLink = el('button', 'profile-link', 'Back to Login');
    backLink.type = 'button';
    backLink.addEventListener('click', renderLogin);

    form.appendChild(username);
    form.appendChild(password);
    form.appendChild(confirm);
    form.appendChild(submit);
    form.appendChild(backLink);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var u = username.value.trim();
      var p = password.value.trim();
      var c = confirm.value.trim();
      if (!u || !p || !c) {
        showBanner(form, 'error', 'All fields are required.');
        return;
      }
      if (p !== c) {
        showBanner(form, 'error', 'Passwords do not match.');
        return;
      }
      setLoading(form, true);
      api.register(u, p).then(function() {
        renderView();
      }).catch(function(err) {
        setLoading(form, false);
        showBanner(form, 'error', err.message);
      });
    });

    container.appendChild(form);
  }

  function renderProfileCard(user) {
    clear();
    var card = el('div', 'profile-card');
    card.appendChild(el('h2', 'profile-card-title', 'Profile'));

    var nameRow = el('p', 'profile-username');
    nameRow.appendChild(el('span', 'profile-label', 'Username: '));
    nameRow.appendChild(document.createTextNode(user.username));
    card.appendChild(nameRow);

    var sinceRow = el('p', 'profile-since');
    sinceRow.appendChild(el('span', 'profile-label', 'Member since: '));
    sinceRow.appendChild(document.createTextNode(formatDate(user.createdAt)));
    card.appendChild(sinceRow);

    var editBtn = el('button', 'profile-btn', 'Edit Profile');
    editBtn.type = 'button';
    editBtn.addEventListener('click', function() {
      renderEdit(user);
    });
    card.appendChild(editBtn);

    var logoutBtn = el('button', 'profile-link', 'Log Out');
    logoutBtn.type = 'button';
    logoutBtn.addEventListener('click', function() {
      api.logout().then(renderLogin);
    });
    card.appendChild(logoutBtn);

    container.appendChild(card);
  }

  function renderEdit(user) {
    clear();
    var form = el('form', 'profile-form');
    form.appendChild(el('h2', 'profile-form-title', 'Edit Profile'));

    var username = el('input', 'profile-input');
    username.type = 'text';
    username.name = 'username';
    username.placeholder = 'New username (optional)';
    username.value = user.username;
    username.setAttribute('aria-label', 'New username');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'New password (optional)';
    password.setAttribute('aria-label', 'New password');

    var current = el('input', 'profile-input');
    current.type = 'password';
    current.name = 'current';
    current.placeholder = 'Current password (required)';
    current.setAttribute('aria-label', 'Current password');

    var submit = el('button', 'profile-btn', 'Save Changes');
    submit.type = 'submit';

    var cancelLink = el('button', 'profile-link', 'Cancel');
    cancelLink.type = 'button';
    cancelLink.addEventListener('click', function() {
      renderProfileCard(user);
    });

    form.appendChild(username);
    form.appendChild(password);
    form.appendChild(current);
    form.appendChild(submit);
    form.appendChild(cancelLink);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var u = username.value.trim();
      var p = password.value.trim();
      var cur = current.value.trim();
      if (!cur) {
        showBanner(form, 'error', 'Current password is required.');
        return;
      }
      setLoading(form, true);
      api.updateProfile(cur, u, p).then(function(updated) {
        showBanner(form, 'success', 'Profile updated.');
        setLoading(form, false);
        renderProfileCard(updated);
      }).catch(function(err) {
        setLoading(form, false);
        showBanner(form, 'error', err.message);
      });
    });

    container.appendChild(form);
  }

  function renderView() {
    api.getCurrentUser().then(function(user) {
      if (user) {
        renderProfileCard(user);
      } else {
        renderLogin();
      }
    }).catch(function() {
      renderLogin();
    });
  }

  renderView();
}

var ForemanProfileUI = {
  renderProfile: renderProfile
};

if (typeof window !== 'undefined') {
  window.ForemanProfileUI = ForemanProfileUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanProfileUI;
}

})();
