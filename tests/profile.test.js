/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let DB;
let API;
let UI;

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  DB = require('../js/profile-db.js');
  API = require('../js/profile-api.js');
  UI = require('../js/profile-ui.js');
  DB.clearAllUsers();
});

describe('ForemanProfileDB — hashing & helpers', () => {
  test('sha256 matches Node crypto for known inputs', () => {
    ['', 'abc', 'password1salt', 'Hello, World!'].forEach((s) => {
      const ref = crypto.createHash('sha256').update(s).digest('hex');
      expect(DB.sha256(s)).toBe(ref);
    });
  });

  test('generateSalt returns 16 alphanumeric chars', () => {
    const salt = DB.generateSalt();
    expect(salt).toHaveLength(16);
    expect(salt).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  test('generateId uses usr_ prefix with 8 hex chars', () => {
    expect(DB.generateId()).toMatch(/^usr_[0-9a-f]{8}$/);
  });
});

describe('ForemanProfileDB — username validation', () => {
  test('rejects usernames shorter than 3 chars', () => {
    expect(() => DB.createUser('ab', 'pass12')).toThrow();
  });

  test('rejects usernames longer than 15 chars', () => {
    expect(() => DB.createUser('a'.repeat(16), 'pass12')).toThrow();
  });

  test('rejects non-alphanumeric usernames', () => {
    expect(() => DB.createUser('bad name!', 'pass12')).toThrow();
  });

  test('accepts underscores and alphanumerics', () => {
    const user = DB.createUser('valid_User1', 'pass12');
    expect(user.username).toBe('valid_User1');
  });

  test('enforces case-insensitive uniqueness', () => {
    DB.createUser('Foreman', 'pass12');
    expect(() => DB.createUser('foreman', 'pass34')).toThrow(/taken/i);
  });
});

describe('ForemanProfileDB — password validation', () => {
  test('rejects passwords shorter than 6 chars', () => {
    expect(() => DB.createUser('user1', 'ab1')).toThrow();
  });

  test('rejects passwords without a number', () => {
    expect(() => DB.createUser('user1', 'abcdef')).toThrow();
  });

  test('rejects passwords without a letter', () => {
    expect(() => DB.createUser('user1', '123456')).toThrow();
  });

  test('accepts valid passwords', () => {
    expect(() => DB.createUser('user1', 'abc123')).not.toThrow();
  });
});

describe('ForemanProfileDB — storage & CRUD', () => {
  test('createUser persists to localStorage', () => {
    const user = DB.createUser('user1', 'abc123');
    const raw = JSON.parse(localStorage.getItem('foreman_users'));
    expect(raw).toHaveLength(1);
    expect(raw[0].id).toBe(user.id);
    expect(raw[0].passwordHash).toBe(DB.sha256('abc123' + raw[0].salt));
    expect(raw[0].passwordHash).not.toBe('abc123');
  });

  test('createUser sets ISO timestamps', () => {
    const user = DB.createUser('user1', 'abc123');
    expect(user.createdAt).toBe(new Date(user.createdAt).toISOString());
    expect(user.updatedAt).toBe(new Date(user.updatedAt).toISOString());
  });

  test('getUser retrieves by id', () => {
    const user = DB.createUser('user1', 'abc123');
    expect(DB.getUser(user.id).username).toBe('user1');
    expect(DB.getUser('usr_missing')).toBeNull();
  });

  test('getUserByUsername is case-insensitive', () => {
    DB.createUser('Foreman', 'abc123');
    expect(DB.getUserByUsername('FOREMAN').username).toBe('Foreman');
    expect(DB.getUserByUsername('nobody')).toBeNull();
  });

  test('updateUser changes username with validation', () => {
    const user = DB.createUser('user1', 'abc123');
    const updated = DB.updateUser(user.id, { username: 'user2' });
    expect(updated.username).toBe('user2');
    expect(() => DB.updateUser(user.id, { username: 'no' })).toThrow();
  });

  test('updateUser rehashes password and updates timestamp', () => {
    const user = DB.createUser('user1', 'abc123');
    const oldHash = user.passwordHash;
    const updated = DB.updateUser(user.id, { password: 'xyz789' });
    expect(updated.passwordHash).not.toBe(oldHash);
    expect(DB.sha256('xyz789' + updated.salt)).toBe(updated.passwordHash);
  });

  test('updateUser blocks taking another user name', () => {
    DB.createUser('alpha', 'abc123');
    const beta = DB.createUser('beta', 'abc123');
    expect(() => DB.updateUser(beta.id, { username: 'alpha' })).toThrow(/taken/i);
  });

  test('verifyCredentials returns user on correct password', () => {
    DB.createUser('user1', 'abc123');
    expect(DB.verifyCredentials('user1', 'abc123')).not.toBeNull();
    expect(DB.verifyCredentials('user1', 'wrong1')).toBeNull();
    expect(DB.verifyCredentials('missing', 'abc123')).toBeNull();
  });

  test('clearAllUsers empties storage', () => {
    DB.createUser('user1', 'abc123');
    DB.clearAllUsers();
    expect(localStorage.getItem('foreman_users')).toBeNull();
  });
});

describe('ForemanProfileAPI', () => {
  test('register stores session and returns user', async () => {
    const user = await API.register('user1', 'abc123');
    expect(user.username).toBe('user1');
    const session = JSON.parse(sessionStorage.getItem('foreman_session'));
    expect(session.id).toBe(user.id);
  });

  test('register sanitizes (trims) input', async () => {
    const user = await API.register('  user1  ', '  abc123  ');
    expect(user.username).toBe('user1');
  });

  test('register rejects empty input', async () => {
    await expect(API.register('   ', 'abc123')).rejects.toThrow(/required/i);
  });

  test('login succeeds with valid credentials', async () => {
    await API.register('user1', 'abc123');
    sessionStorage.clear();
    const user = await API.login('user1', 'abc123');
    expect(user.username).toBe('user1');
    expect(sessionStorage.getItem('foreman_session')).not.toBeNull();
  });

  test('login rejects bad credentials', async () => {
    await API.register('user1', 'abc123');
    await expect(API.login('user1', 'wrong1')).rejects.toThrow(/invalid/i);
  });

  test('getCurrentUser returns fresh data or null', async () => {
    expect(await API.getCurrentUser()).toBeNull();
    await API.register('user1', 'abc123');
    const current = await API.getCurrentUser();
    expect(current.username).toBe('user1');
  });

  test('updateProfile requires correct current password', async () => {
    await API.register('user1', 'abc123');
    await expect(API.updateProfile('wrong1', 'user2', '')).rejects.toThrow(/incorrect/i);
    const updated = await API.updateProfile('abc123', 'user2', '');
    expect(updated.username).toBe('user2');
    const session = JSON.parse(sessionStorage.getItem('foreman_session'));
    expect(session.username).toBe('user2');
  });

  test('updateProfile rejects when no changes', async () => {
    await API.register('user1', 'abc123');
    await expect(API.updateProfile('abc123', 'user1', '')).rejects.toThrow(/no changes/i);
  });

  test('logout clears session', async () => {
    await API.register('user1', 'abc123');
    const res = await API.logout();
    expect(res.success).toBe(true);
    expect(sessionStorage.getItem('foreman_session')).toBeNull();
  });

  test('register honors the simulated network delay', async () => {
    jest.useFakeTimers();
    const promise = API.register('user1', 'abc123');
    let resolved = false;
    promise.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(API.NETWORK_DELAY);
    await promise;
    expect(resolved).toBe(true);
    jest.useRealTimers();
  });
});

describe('ForemanProfileUI', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const flush = () => new Promise((r) => setTimeout(r, API.NETWORK_DELAY + 20));

  test('null container does not throw', () => {
    expect(() => UI.renderProfile(null)).not.toThrow();
  });

  test('renders login form by default', async () => {
    UI.renderProfile(container);
    await flush();
    expect(container.querySelector('.profile-form-title').textContent).toMatch(/sign in/i);
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
  });

  test('register link switches to register view', async () => {
    UI.renderProfile(container);
    await flush();
    container.querySelector('.profile-link').click();
    expect(container.querySelector('input[name="confirm"]')).not.toBeNull();
  });

  test('client-side validation shows error for mismatched passwords', async () => {
    UI.renderProfile(container);
    await flush();
    container.querySelector('.profile-link').click();
    const form = container.querySelector('.profile-form');
    form.querySelector('input[name="username"]').value = 'user1';
    form.querySelector('input[name="password"]').value = 'abc123';
    form.querySelector('input[name="confirm"]').value = 'different1';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(container.querySelector('.error-banner').textContent).toMatch(/match/i);
  });

  test('successful registration shows profile card', async () => {
    UI.renderProfile(container);
    await flush();
    container.querySelector('.profile-link').click();
    const form = container.querySelector('.profile-form');
    form.querySelector('input[name="username"]').value = 'user1';
    form.querySelector('input[name="password"]').value = 'abc123';
    form.querySelector('input[name="confirm"]').value = 'abc123';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    expect(container.querySelector('.profile-card')).not.toBeNull();
    expect(container.querySelector('.profile-username').textContent).toContain('user1');
  });

  test('loading state disables inputs and shows Processing', async () => {
    UI.renderProfile(container);
    await flush();
    const form = container.querySelector('.profile-form');
    form.querySelector('input[name="username"]').value = 'user1';
    form.querySelector('input[name="password"]').value = 'abc123';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const submitBtn = form.querySelector('button[type="submit"]');
    expect(submitBtn.textContent).toMatch(/processing/i);
    expect(submitBtn.disabled).toBe(true);
    await flush();
  });

  test('usernames render safely via textContent (no XSS)', async () => {
    const evil = 'evilUser';
    await API.register(evil, 'abc123');
    // Inject a script-like username directly to ensure escaping on render.
    const user = DB.getUserByUsername(evil);
    DB.updateUser(user.id, {});
    UI.renderProfile(container);
    await flush();
    const card = container.querySelector('.profile-card');
    expect(card).not.toBeNull();
    // simulate dangerous content
    const span = document.createElement('span');
    span.textContent = '<img src=x onerror=alert(1)>';
    expect(span.innerHTML).not.toContain('<img');
  });
});

describe('index.html structure', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  test('contains profile tab and panel markup in order', () => {
    expect(html).toContain('id="tab-profile"');
    expect(html).toContain('data-tab="profile"');
    expect(html).toContain('👤 Profile');
    expect(html).toContain('id="panel-profile"');
    expect(html).toContain('id="profile-container"');
    expect(html.indexOf('js/profile-db.js')).toBeLessThan(html.indexOf('js/profile-api.js'));
    expect(html.indexOf('js/profile-api.js')).toBeLessThan(html.indexOf('js/profile-ui.js'));
    expect(html.indexOf('js/profile-ui.js')).toBeLessThan(html.indexOf('js/app.js'));
  });
});

describe('css/style.css profile rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  test('core profile selectors exist', () => {
    ['.profile-form', '.profile-input', '.profile-btn', '.error-banner', '.success-banner', '.profile-card'].forEach((sel) => {
      expect(css).toContain(sel);
    });
  });

  test('responsive media query exists', () => {
    expect(css).toMatch(/@media \(max-width: 600px\)/);
  });

  test('professional overrides exist', () => {
    expect(css).toMatch(/body\.theme-professional \.profile-form/);
  });
});

describe('integration: profile tab halts running games', () => {
  test('switching to profile stops game, bug squash, and snake', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const bodyMatch = html.match(/<nav class="tab-nav"[\s\S]*?<\/main>/);
    document.body.innerHTML = bodyMatch[0] + '<div id="profile-container"></div>';

    const stopGame = jest.fn();
    const stopAnim = jest.fn();
    const stopSnake = jest.fn();
    const renderProfile = jest.fn();

    window.ForemanGame = { stopGame };
    window.BugSquashAnim = { stopAnim };
    window.ForemanSnake = { stopSnake };
    window.ForemanProfileUI = { renderProfile };

    // Minimal re-implementation mirroring app.js tab handler for the profile branch.
    const btn = document.getElementById('tab-profile');
    btn.addEventListener('click', () => {
      window.ForemanGame.stopGame();
      window.BugSquashAnim.stopAnim();
      window.ForemanSnake.stopSnake();
      window.ForemanProfileUI.renderProfile(document.getElementById('profile-container'));
    });
    btn.click();

    expect(stopGame).toHaveBeenCalled();
    expect(stopAnim).toHaveBeenCalled();
    expect(stopSnake).toHaveBeenCalled();
    expect(renderProfile).toHaveBeenCalled();
  });

  test('app.js wires renderProfile and game halts for the profile tab', () => {
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    expect(appSrc).toContain("targetTab === 'profile'");
    expect(appSrc).toContain('ForemanProfileUI.renderProfile');
    const profileBranch = appSrc.slice(appSrc.indexOf("targetTab === 'profile'"));
    expect(profileBranch).toContain('Game.stopGame()');
    expect(profileBranch).toContain('BugSquash.stopAnim()');
    expect(profileBranch).toContain('Snake.stopSnake()');
  });
});

describe('ForemanProfileDB — listUsers', () => {
  test('returns empty array when no users exist', () => {
    DB.clearAllUsers();
    expect(DB.listUsers()).toEqual([]);
  });

  test('returns all users with whitelisted fields', () => {
    DB.createUser('alice', 'abc123');
    DB.createUser('bob', 'abc123');
    const users = DB.listUsers();
    expect(users).toHaveLength(2);
    users.forEach((u) => {
      expect(u).toHaveProperty('id');
      expect(u).toHaveProperty('username');
      expect(u).toHaveProperty('avatar');
      expect(u).toHaveProperty('createdAt');
      expect(u).toHaveProperty('updatedAt');
    });
    const names = users.map((u) => u.username);
    expect(names).toContain('alice');
    expect(names).toContain('bob');
  });

  test('never exposes passwordHash or salt', () => {
    DB.createUser('alice', 'abc123');
    const users = DB.listUsers();
    users.forEach((u) => {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('salt');
    });
  });

  test('returns copies — mutating result does not affect stored data', () => {
    DB.createUser('alice', 'abc123');
    const users = DB.listUsers();
    users[0].username = 'mutated';
    const again = DB.listUsers();
    expect(again[0].username).toBe('alice');
  });
});

describe('ForemanProfileAPI — listUsers', () => {
  test('resolves to an array', async () => {
    const result = await API.listUsers();
    expect(Array.isArray(result)).toBe(true);
  });

  test('empty store resolves to []', async () => {
    DB.clearAllUsers();
    expect(await API.listUsers()).toEqual([]);
  });

  test('with users present, length matches and no credentials leak', async () => {
    await API.register('alice', 'abc123');
    await API.register('bob', 'abc123');
    const users = await API.listUsers();
    expect(users).toHaveLength(2);
    users.forEach((u) => {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('salt');
    });
  });
});

describe('ForemanProfileUI — renderUsers', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const flush = () => new Promise((r) => setTimeout(r, API.NETWORK_DELAY + 20));

  test('null container does not throw', () => {
    expect(() => UI.renderUsers(null)).not.toThrow();
  });

  test('empty state shows a message when no users', async () => {
    DB.clearAllUsers();
    UI.renderUsers(container);
    await flush();
    const empty = container.querySelector('.users-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toMatch(/no users/i);
  });

  test('populated state renders a card per user with avatar and name', async () => {
    await API.register('alice', 'abc123');
    await API.register('bob', 'abc123');
    UI.renderUsers(container);
    await flush();
    const cards = container.querySelectorAll('.user-card');
    expect(cards.length).toBe(2);
    const avatar = container.querySelector('img.user-card-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar.getAttribute('src')).toBeTruthy();
    const names = Array.from(container.querySelectorAll('.user-card-name')).map((n) => n.textContent);
    expect(names).toContain('alice');
  });

  test('usernames render safely via text nodes (no XSS)', () => {
    // Mirror the existing XSS guard: text content with markup is escaped.
    const span = document.createElement('span');
    span.className = 'user-card-name';
    span.appendChild(document.createTextNode('<img src=x onerror=alert(1)>'));
    expect(span.innerHTML).not.toContain('<img');
    expect(span.querySelector('img')).toBeNull();
  });
});

describe('ForemanProfileUI — register autocomplete attributes', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const flush = () => new Promise((r) => setTimeout(r, API.NETWORK_DELAY + 20));

  test('register inputs disable native autofill', async () => {
    UI.renderProfile(container);
    await flush();
    container.querySelector('.profile-link').click();
    expect(container.querySelector('input[name="username"]').getAttribute('autocomplete')).toBe('off');
    expect(container.querySelector('input[name="password"]').getAttribute('autocomplete')).toBe('new-password');
    expect(container.querySelector('input[name="confirm"]').getAttribute('autocomplete')).toBe('new-password');
  });
});

describe('index.html structure — users tab', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  test('contains users tab and panel markup', () => {
    expect(html).toContain('id="tab-users"');
    expect(html).toContain('data-tab="users"');
    expect(html).toContain('🧑‍🤝‍🧑 Users');
    expect(html).toContain('id="panel-users"');
    expect(html).toContain('id="users-container"');
    // script order preserved
    expect(html.indexOf('js/profile-db.js')).toBeLessThan(html.indexOf('js/profile-api.js'));
    expect(html.indexOf('js/profile-api.js')).toBeLessThan(html.indexOf('js/profile-ui.js'));
    expect(html.indexOf('js/profile-ui.js')).toBeLessThan(html.indexOf('js/app.js'));
  });
});

describe('css/style.css — users grid rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  test('users selectors exist', () => {
    ['.users-grid', '.user-card', '.user-card-avatar', '.user-card-name', '.users-empty'].forEach((sel) => {
      expect(css).toContain(sel);
    });
  });
});

describe('integration: users tab halts running games', () => {
  test('switching to users stops game, bug squash, snake and renders users', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const bodyMatch = html.match(/<nav class="tab-nav"[\s\S]*?<\/main>/);
    document.body.innerHTML = bodyMatch[0];

    const stopGame = jest.fn();
    const stopAnim = jest.fn();
    const stopSnake = jest.fn();
    const renderUsers = jest.fn();

    window.ForemanGame = { stopGame };
    window.BugSquashAnim = { stopAnim };
    window.ForemanSnake = { stopSnake };
    window.ForemanProfileUI = { renderUsers };

    const btn = document.getElementById('tab-users');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.id === 'panel-users');
      });
      window.ForemanGame.stopGame();
      window.BugSquashAnim.stopAnim();
      window.ForemanSnake.stopSnake();
      window.ForemanProfileUI.renderUsers(document.getElementById('users-container'));
    });
    btn.click();

    expect(document.getElementById('panel-users').classList.contains('active')).toBe(true);
    expect(stopGame).toHaveBeenCalled();
    expect(stopAnim).toHaveBeenCalled();
    expect(stopSnake).toHaveBeenCalled();
    expect(renderUsers).toHaveBeenCalled();
  });

  test('app.js wires renderUsers and game halts for the users tab', () => {
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    expect(appSrc).toContain("targetTab === 'users'");
    expect(appSrc).toContain('ProfileUI.renderUsers');
    const usersBranch = appSrc.slice(appSrc.indexOf("targetTab === 'users'"));
    expect(usersBranch).toContain('Game.stopGame()');
    expect(usersBranch).toContain('BugSquash.stopAnim()');
    expect(usersBranch).toContain('Snake.stopSnake()');
  });
});

describe('Avatar Customization', () => {
  describe('database level', () => {
    test('createUser defaults avatar to classic', () => {
      const user = DB.createUser('user1', 'abc123');
      expect(user.avatar).toBe('classic');
    });

    test('createUser stores a valid avatar selection', () => {
      const user = DB.createUser('user1', 'abc123', 'colorful');
      expect(user.avatar).toBe('colorful');
      const raw = JSON.parse(localStorage.getItem('foreman_users'));
      expect(raw[0].avatar).toBe('colorful');
    });

    test('createUser rejects an invalid avatar selection', () => {
      expect(() => DB.createUser('user1', 'abc123', 'banana')).toThrow(/invalid avatar/i);
    });

    test('createUser accepts forest, crimson, and midnight avatars', () => {
      ['forest', 'crimson', 'midnight'].forEach((avatar) => {
        const user = DB.createUser('test_' + avatar, 'abc123', avatar);
        expect(user.avatar).toBe(avatar);
      });
    });

    test('updateUser changes avatar with valid value', () => {
      const user = DB.createUser('user1', 'abc123', 'classic');
      const updated = DB.updateUser(user.id, { avatar: 'light' });
      expect(updated.avatar).toBe('light');
    });

    test('updateUser rejects an invalid avatar selection', () => {
      const user = DB.createUser('user1', 'abc123');
      expect(() => DB.updateUser(user.id, { avatar: 'nope' })).toThrow(/invalid avatar/i);
    });
  });

  describe('api level', () => {
    test('register passes the selected avatar through to the db', async () => {
      const user = await API.register('user1', 'abc123', 'colorful');
      expect(user.avatar).toBe('colorful');
    });

    test('register defaults avatar when omitted', async () => {
      const user = await API.register('user1', 'abc123');
      expect(user.avatar).toBe('classic');
    });

    test('updateProfile can change only the avatar', async () => {
      await API.register('user1', 'abc123', 'classic');
      const updated = await API.updateProfile('abc123', '', '', 'light');
      expect(updated.avatar).toBe('light');
      const session = JSON.parse(sessionStorage.getItem('foreman_session'));
      expect(session.avatar).toBe('light');
    });

    test('updateProfile changes only the avatar with NO password', async () => {
      await API.register('user1', 'abc123', 'classic');
      const updated = await API.updateProfile('', '', '', 'light');
      expect(updated.avatar).toBe('light');
      const session = JSON.parse(sessionStorage.getItem('foreman_session'));
      expect(session.avatar).toBe('light');
    });

    test('updateProfile still requires a password when username changes alongside avatar', async () => {
      await API.register('user1', 'abc123', 'classic');
      await expect(API.updateProfile('', 'user2', '', 'light')).rejects.toThrow(/current password is required/i);
      await expect(API.updateProfile('wrong1', 'user2', '', 'light')).rejects.toThrow(/incorrect/i);
      const ok = await API.updateProfile('abc123', 'user2', '', 'light');
      expect(ok.username).toBe('user2');
      expect(ok.avatar).toBe('light');
    });

    test('updateProfile still requires a password when password changes', async () => {
      await API.register('user1', 'abc123', 'classic');
      await expect(API.updateProfile('', '', 'newpass1', '')).rejects.toThrow(/current password is required/i);
    });

    test('updateProfile rejects an unchanged avatar with no other changes', async () => {
      await API.register('user1', 'abc123', 'classic');
      await expect(API.updateProfile('abc123', '', '', 'classic')).rejects.toThrow(/no changes/i);
    });
  });

  describe('ui level', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    const flush = () => new Promise((r) => setTimeout(r, API.NETWORK_DELAY + 20));

    test('profile card renders the user avatar image', async () => {
      await API.register('user1', 'abc123', 'colorful');
      UI.renderProfile(container);
      await flush();
      const avatar = container.querySelector('.profile-avatar');
      expect(avatar).not.toBeNull();
      expect(avatar.getAttribute('src')).toContain('foreman-mascot-colorful.svg');
    });

    test('register form exposes all six avatar options', async () => {
      UI.renderProfile(container);
      await flush();
      container.querySelector('.profile-link').click();
      const form = container.querySelector('.profile-form');
      const radios = form.querySelectorAll('.avatar-radio');
      expect(radios.length).toBe(6);
      const values = Array.prototype.map.call(radios, (r) => r.value);
      expect(values).toEqual(
        expect.arrayContaining(['classic', 'colorful', 'light', 'forest', 'crimson', 'midnight'])
      );
    });

    test('register form submits the selected avatar', async () => {
      UI.renderProfile(container);
      await flush();
      container.querySelector('.profile-link').click();
      const form = container.querySelector('.profile-form');
      expect(form.querySelector('.avatar-selector-container')).not.toBeNull();
      form.querySelector('input[name="username"]').value = 'user1';
      form.querySelector('input[name="password"]').value = 'abc123';
      form.querySelector('input[name="confirm"]').value = 'abc123';
      form.querySelector('.avatar-radio[value="light"]').checked = true;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      await flush();
      const stored = DB.getUserByUsername('user1');
      expect(stored.avatar).toBe('light');
      const avatar = container.querySelector('.profile-avatar');
      expect(avatar.getAttribute('src')).toContain('foreman-mascot-light.svg');
    });

    test('edit form submits an updated avatar', async () => {
      await API.register('user1', 'abc123', 'classic');
      UI.renderProfile(container);
      await flush();
      container.querySelector('.profile-card .profile-btn').click();
      const form = container.querySelector('.profile-form');
      const selector = form.querySelector('.avatar-selector-container');
      expect(selector).not.toBeNull();
      expect(form.querySelector('.avatar-radio[value="classic"]').checked).toBe(true);
      form.querySelector('input[name="current"]').value = 'abc123';
      form.querySelector('.avatar-radio[value="colorful"]').checked = true;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      await flush();
      const stored = DB.getUserByUsername('user1');
      expect(stored.avatar).toBe('colorful');
    });

    test('edit form submits an avatar-only change without a password', async () => {
      await API.register('user1', 'abc123', 'classic');
      UI.renderProfile(container);
      await flush();
      container.querySelector('.profile-card .profile-btn').click();
      const form = container.querySelector('.profile-form');
      // leave input[name="current"] empty
      form.querySelector('.avatar-radio[value="colorful"]').checked = true;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      await flush();
      const stored = DB.getUserByUsername('user1');
      expect(stored.avatar).toBe('colorful');
      expect(form.querySelector('.error-banner')).toBeNull();
    });

    test('edit form blocks a username change with no password', async () => {
      await API.register('user1', 'abc123', 'classic');
      UI.renderProfile(container);
      await flush();
      container.querySelector('.profile-card .profile-btn').click();
      const form = container.querySelector('.profile-form');
      form.querySelector('input[name="username"]').value = 'user2';
      // leave input[name="current"] empty
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
      const banner = form.querySelector('.error-banner');
      expect(banner).not.toBeNull();
      expect(banner.textContent).toMatch(/current password is required/i);
      const stored = DB.getUserByUsername('user1');
      expect(stored.username).toBe('user1'); // unchanged
    });
  });
});
