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

var AVATAR_OPTIONS = [
  { id: 'classic', name: 'Classic', src: 'assets/foreman-mascot.svg' },
  { id: 'colorful', name: 'Cyberpunk', src: 'assets/foreman-mascot-colorful.svg' },
  { id: 'light', name: 'Construction Light', src: 'assets/foreman-mascot-light.svg' },
  { id: 'forest', name: 'Forest Ranger', src: 'assets/foreman-mascot-forest.svg' },
  { id: 'crimson', name: 'Fire Chief', src: 'assets/foreman-mascot-crimson.svg' },
  { id: 'midnight', name: 'Midnight', src: 'assets/foreman-mascot-midnight.svg' }
];

function avatarSrc(id) {
  for (var i = 0; i < AVATAR_OPTIONS.length; i++) {
    if (AVATAR_OPTIONS[i].id === id) return AVATAR_OPTIONS[i].src;
  }
  return AVATAR_OPTIONS[0].src;
}

function createAvatarSelector(selectedId) {
  if (!selectedId) selectedId = 'classic';
  var container = el('div', 'avatar-selector-container');
  container.appendChild(el('span', 'avatar-selector-label', 'Choose your mascot'));

  var grid = el('div', 'avatar-options-grid');
  for (var i = 0; i < AVATAR_OPTIONS.length; i++) {
    var option = AVATAR_OPTIONS[i];
    var label = el('label', 'avatar-option-item');

    var radio = el('input', 'avatar-radio');
    radio.type = 'radio';
    radio.name = 'avatar';
    radio.value = option.id;
    if (option.id === selectedId) radio.checked = true;
    radio.setAttribute('aria-label', option.name);

    var img = el('img', 'avatar-option-img');
    img.src = option.src;
    img.alt = option.name + ' mascot';

    label.appendChild(radio);
    label.appendChild(img);
    label.appendChild(el('span', 'avatar-option-name', option.name));
    grid.appendChild(label);
  }
  container.appendChild(grid);
  return container;
}

function selectedAvatarValue(form) {
  var checked = form.querySelector('.avatar-radio:checked');
  return checked ? checked.value : 'classic';
}

function showBanner(form, type, message) {
  var existing = form.querySelector('.error-banner, .success-banner');
  if (existing) existing.parentNode.removeChild(existing);
  var banner = el('div', type === 'error' ? 'error-banner' : 'success-banner', message);
  banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
  form.insertBefore(banner, form.firstChild);
}

function emitAuthChanged() {
  if (typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new window.CustomEvent('foreman:auth-changed'));
  }
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
    username.setAttribute('autocomplete', 'off');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'Password';
    password.setAttribute('aria-label', 'Password');
    password.setAttribute('autocomplete', 'new-password');

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
        emitAuthChanged();
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
    username.setAttribute('autocomplete', 'off');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'Password';
    password.setAttribute('aria-label', 'Password');
    password.setAttribute('autocomplete', 'new-password');

    var confirm = el('input', 'profile-input');
    confirm.type = 'password';
    confirm.name = 'confirm';
    confirm.placeholder = 'Confirm Password';
    confirm.setAttribute('aria-label', 'Confirm Password');
    confirm.setAttribute('autocomplete', 'new-password');

    var submit = el('button', 'profile-btn', 'Register');
    submit.type = 'submit';

    var backLink = el('button', 'profile-link', 'Back to Login');
    backLink.type = 'button';
    backLink.addEventListener('click', renderLogin);

    var avatarSelector = createAvatarSelector('classic');

    form.appendChild(username);
    form.appendChild(password);
    form.appendChild(confirm);
    form.appendChild(avatarSelector);
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
      var avatar = selectedAvatarValue(form);
      setLoading(form, true);
      api.register(u, p, avatar).then(function() {
        emitAuthChanged();
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

    var avatar = el('img', 'profile-avatar');
    avatar.src = avatarSrc(user.avatar);
    avatar.alt = 'Profile avatar';
    card.appendChild(avatar);

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
      api.logout().then(function() {
        emitAuthChanged();
        renderLogin();
      });
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
    username.setAttribute('autocomplete', 'off');

    var password = el('input', 'profile-input');
    password.type = 'password';
    password.name = 'password';
    password.placeholder = 'New password (optional)';
    password.setAttribute('aria-label', 'New password');
    password.setAttribute('autocomplete', 'new-password');

    var current = el('input', 'profile-input');
    current.type = 'password';
    current.name = 'current';
    current.placeholder = 'Current password (required to change username/password)';
    current.setAttribute('aria-label', 'Current password');
    current.setAttribute('autocomplete', 'new-password');

    var submit = el('button', 'profile-btn', 'Save Changes');
    submit.type = 'submit';

    var cancelLink = el('button', 'profile-link', 'Cancel');
    cancelLink.type = 'button';
    cancelLink.addEventListener('click', function() {
      renderProfileCard(user);
    });

    var avatarSelector = createAvatarSelector(user.avatar || 'classic');

    form.appendChild(username);
    form.appendChild(password);
    form.appendChild(current);
    form.appendChild(avatarSelector);
    form.appendChild(submit);
    form.appendChild(cancelLink);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var u = username.value.trim();
      var p = password.value.trim();
      var cur = current.value.trim();
      var usernameChanged = u && u !== user.username;
      var passwordChanged = !!p;
      if ((usernameChanged || passwordChanged) && !cur) {
        showBanner(form, 'error', 'Current password is required.');
        return;
      }
      var avatar = selectedAvatarValue(form);
      setLoading(form, true);
      api.updateProfile(cur, u, p, avatar).then(function(updated) {
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

function renderUsers(container) {
  if (!container) return;
  var api = getAPI();
  container.innerHTML = '';

  var wrapper = el('div', 'users-list');
  wrapper.appendChild(el('h2', 'users-list-title', 'All Users'));

  var grid = el('div', 'users-grid');
  wrapper.appendChild(grid);
  container.appendChild(wrapper);

  function renderEmpty() {
    grid.innerHTML = '';
    grid.appendChild(el('p', 'users-empty', 'No users have registered yet.'));
  }

  if (!api || typeof api.listUsers !== 'function') {
    renderEmpty();
    return;
  }

  api.listUsers().then(function(users) {
    grid.innerHTML = '';
    if (!users || users.length === 0) {
      renderEmpty();
      return;
    }
    for (var i = 0; i < users.length; i++) {
      var user = users[i];
      var card = el('div', 'user-card');

      var img = el('img', 'user-card-avatar');
      img.src = avatarSrc(user.avatar);
      img.alt = 'User avatar';
      card.appendChild(img);

      // username rendered via text node — never innerHTML (XSS-safe)
      var nameEl = el('span', 'user-card-name');
      nameEl.appendChild(document.createTextNode(user.username == null ? '' : String(user.username)));
      card.appendChild(nameEl);

      grid.appendChild(card);
    }
  }).catch(function() {
    renderEmpty();
  });
}

var ForemanProfileUI = {
  renderProfile: renderProfile,
  renderUsers: renderUsers
};

if (typeof window !== 'undefined') {
  window.ForemanProfileUI = ForemanProfileUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForemanProfileUI;
}

})();
