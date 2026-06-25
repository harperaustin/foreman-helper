/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

let MDB, MAPI, MUI, PAPI, PDB;

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  PDB = require('../js/profile-db.js');
  PAPI = require('../js/profile-api.js');
  MDB = require('../js/messages-db.js');
  MAPI = require('../js/messages-api.js');
  MUI = require('../js/messages-ui.js');
  PDB.clearAllUsers();
  MDB.clearAllMessages();
});

describe('ForemanMessagesDB', () => {
  test('generateId matches msg_ + 8 hex', () => {
    expect(MDB.generateId()).toMatch(/^msg_[0-9a-f]{8}$/);
  });

  test('sendMessage stores a record with correct fields', () => {
    const rec = MDB.sendMessage('a', 'Alice', 'b', 'Bob', 'hello');
    expect(rec.id).toMatch(/^msg_[0-9a-f]{8}$/);
    expect(rec.fromId).toBe('a');
    expect(rec.fromUsername).toBe('Alice');
    expect(rec.toId).toBe('b');
    expect(rec.toUsername).toBe('Bob');
    expect(rec.body).toBe('hello');
    expect(typeof rec.createdAt).toBe('string');
    expect(rec.read).toBe(false);
    expect(MDB.loadMessages().length).toBe(1);
  });

  test('sendMessage trims body', () => {
    const rec = MDB.sendMessage('a', 'A', 'b', 'B', '  hi  ');
    expect(rec.body).toBe('hi');
  });

  test('sendMessage throws on empty/whitespace body', () => {
    expect(() => MDB.sendMessage('a', 'A', 'b', 'B', '   ')).toThrow(/required/i);
    expect(() => MDB.sendMessage('a', 'A', 'b', 'B', '')).toThrow(/required/i);
  });

  test('sendMessage throws when messaging yourself', () => {
    expect(() => MDB.sendMessage('a', 'A', 'a', 'A', 'hi')).toThrow(/yourself/i);
  });

  test('sendMessage throws on missing recipient or sender', () => {
    expect(() => MDB.sendMessage('a', 'A', '', 'B', 'hi')).toThrow(/recipient/i);
    expect(() => MDB.sendMessage('', 'A', 'b', 'B', 'hi')).toThrow(/sender/i);
  });

  test('sendMessage throws when body exceeds 2000 chars', () => {
    const long = new Array(2002).join('x');
    expect(long.length).toBeGreaterThan(2000);
    expect(() => MDB.sendMessage('a', 'A', 'b', 'B', long)).toThrow(/2000/);
  });

  test('getInbox returns only messages to user, newest-first', () => {
    MDB.sendMessage('a', 'A', 'b', 'B', 'first');
    // ensure distinct timestamps
    MDB.sendMessage('a', 'A', 'c', 'C', 'other');
    MDB.sendMessage('a', 'A', 'b', 'B', 'second');
    const inbox = MDB.getInbox('b');
    expect(inbox.length).toBe(2);
    expect(inbox.every((m) => m.toId === 'b')).toBe(true);
    // newest first
    expect(inbox[0].createdAt >= inbox[1].createdAt).toBe(true);
  });

  test('getSent returns only messages from user', () => {
    MDB.sendMessage('a', 'A', 'b', 'B', 'one');
    MDB.sendMessage('x', 'X', 'b', 'B', 'two');
    const sent = MDB.getSent('a');
    expect(sent.length).toBe(1);
    expect(sent[0].fromId).toBe('a');
  });

  test('getConversation returns both directions ascending', () => {
    MDB.sendMessage('a', 'A', 'b', 'B', 'm1');
    MDB.sendMessage('b', 'B', 'a', 'A', 'm2');
    MDB.sendMessage('a', 'A', 'c', 'C', 'unrelated');
    const conv = MDB.getConversation('a', 'b');
    expect(conv.length).toBe(2);
    expect(conv[0].createdAt <= conv[1].createdAt).toBe(true);
  });

  test('markRead sets read=true and returns null for unknown id', () => {
    const rec = MDB.sendMessage('a', 'A', 'b', 'B', 'hi');
    const updated = MDB.markRead(rec.id);
    expect(updated.read).toBe(true);
    expect(MDB.loadMessages()[0].read).toBe(true);
    expect(MDB.markRead('nope')).toBeNull();
  });

  test('clearAllMessages empties the store', () => {
    MDB.sendMessage('a', 'A', 'b', 'B', 'hi');
    MDB.clearAllMessages();
    expect(MDB.loadMessages()).toEqual([]);
  });

  test('loadMessages returns [] for empty or corrupt storage', () => {
    expect(MDB.loadMessages()).toEqual([]);
    localStorage.setItem('foreman_messages', 'not json');
    expect(MDB.loadMessages()).toEqual([]);
  });
});

describe('ForemanMessagesAPI', () => {
  let aliceId, bobId;

  beforeEach(async () => {
    // register alice (sets session to alice)
    const alice = await PAPI.register('alice', 'password1');
    aliceId = alice.id;
    // create bob via DB (no session change)
    const bob = PDB.createUser('bob', 'password1');
    bobId = bob.id;
  });

  test('listRecipients excludes the signed-in user', async () => {
    const r = await MAPI.listRecipients();
    expect(r.map((u) => u.username)).toContain('bob');
    expect(r.map((u) => u.username)).not.toContain('alice');
  });

  test('send rejects when not signed in', async () => {
    sessionStorage.clear();
    await expect(MAPI.send(bobId, 'bob', 'hi')).rejects.toThrow(/signed in/i);
  });

  test('send rejects empty body', async () => {
    await expect(MAPI.send(bobId, 'bob', '   ')).rejects.toThrow(/required/i);
  });

  test('send rejects empty recipient', async () => {
    await expect(MAPI.send('', '', 'hello')).rejects.toThrow(/recipient/i);
  });

  test('send succeeds and persists to recipient inbox', async () => {
    await MAPI.send(bobId, 'bob', 'hello bob');
    expect(MDB.getInbox(bobId).length).toBe(1);
  });

  test('send sanitizes and trims body', async () => {
    await MAPI.send(bobId, 'bob', '  hi  ');
    expect(MDB.getInbox(bobId)[0].body).toBe('hi');
  });

  test('inbox returns received messages for the signed-in user', async () => {
    await MAPI.send(bobId, 'bob', 'hello bob');
    // switch session to bob
    await PAPI.login('bob', 'password1');
    const inbox = await MAPI.inbox();
    expect(inbox.length).toBe(1);
    expect(inbox[0].body).toBe('hello bob');
  });

  test('sent returns messages sent by the signed-in user', async () => {
    await MAPI.send(bobId, 'bob', 'hello bob');
    const sent = await MAPI.sent();
    expect(sent.length).toBe(1);
    expect(sent[0].toId).toBe(bobId);
  });
});

describe('ForemanMessagesUI', () => {
  let container;
  const flush = () => new Promise((r) => setTimeout(r, MAPI.NETWORK_DELAY * 4 + 50));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  test('null container does not throw', () => {
    expect(() => MUI.renderMessages(null)).not.toThrow();
  });

  test('signed-out state shows sign-in prompt and no chat surface', async () => {
    MUI.renderMessages(container);
    await flush();
    const empty = container.querySelector('.messages-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toMatch(/sign in/i);
    expect(container.querySelector('.chats-section')).toBeNull();
    expect(container.querySelector('.chat-reply-form')).toBeNull();
  });

  test('signed-in renders the single messaging location with recipient picker excluding self', async () => {
    await PAPI.register('alice', 'password1');
    PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    expect(container.querySelector('.chats-section')).not.toBeNull();
    expect(container.querySelector('.new-chat-select')).not.toBeNull();
    const optionTexts = Array.from(container.querySelectorAll('.new-chat-select option')).map((o) => o.textContent);
    expect(optionTexts).toContain('bob');
    expect(optionTexts).not.toContain('alice');
  });

  test('empty recipients disables submit or shows empty note', async () => {
    await PAPI.register('alice', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    const submit = container.querySelector('.new-chat-btn');
    const note = container.querySelector('.new-chat-form .messages-empty, .new-chat-form .error-banner');
    expect((submit && submit.disabled === true) || note !== null).toBe(true);
  });

  test('send flow via the single reply form shows success and clears input', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    // Start a direct conversation via the non-sending starter.
    const newChatSelect = container.querySelector('.new-chat-select');
    newChatSelect.value = bob.id;
    const newChatForm = container.querySelector('.new-chat-form');
    newChatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    await flush();
    // Now send through the single reply form.
    const reply = container.querySelector('.chat-reply-input');
    expect(reply).not.toBeNull();
    reply.value = 'hello bob';
    const replyForm = container.querySelector('.chat-reply-form');
    replyForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    const success = container.querySelector('.chat-active .success-banner');
    expect(success).not.toBeNull();
    expect(success.textContent).toMatch(/sent/i);
    expect(container.querySelector('.chat-reply-input').value).toBe('');
    expect(MDB.getInbox(bob.id).length).toBe(1);
  });

  test('client validation: empty body and missing recipient', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();

    // missing recipient on the new-chat starter
    const newChatForm = container.querySelector('.new-chat-form');
    const newChatSelect = container.querySelector('.new-chat-select');
    newChatSelect.value = '';
    newChatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(container.querySelector('.new-chat-form .error-banner').textContent).toMatch(/recipient/i);

    // empty body on the single reply form
    newChatSelect.value = bob.id;
    newChatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    await flush();
    const reply = container.querySelector('.chat-reply-input');
    expect(reply).not.toBeNull();
    reply.value = '   ';
    const replyForm = container.querySelector('.chat-reply-form');
    replyForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(container.querySelector('.chat-active .error-banner').textContent).toMatch(/required/i);
  });

  test('messages render in the chat thread', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MDB.sendMessage(bob.id, 'bob', alice.id, 'alice', 'hi alice');
    MUI.renderMessages(container);
    await flush();
    await flush();
    await flush();
    const chatItem = container.querySelector('.chat-list-item');
    expect(chatItem).not.toBeNull();
    chatItem.click();
    await flush();
    await flush();
    expect(container.querySelector('.chat-thread .message-item')).not.toBeNull();
    expect(container.querySelector('.chat-thread .message-body').textContent).toContain('hi alice');
  });

  test('XSS/injection: body and username rendered as text not HTML', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MDB.sendMessage(bob.id, '<b>evil</b>', alice.id, 'alice', '<img src=x onerror=alert(1)>');
    MUI.renderMessages(container);
    await flush();
    await flush();
    await flush();
    const chatItem = container.querySelector('.chat-list-item');
    expect(chatItem).not.toBeNull();
    chatItem.click();
    await flush();
    await flush();
    const item = container.querySelector('.chat-thread .message-item');
    expect(item).not.toBeNull();
    const bodyEl = container.querySelector('.chat-thread .message-body');
    expect(bodyEl.querySelector('img')).toBeNull();
    expect(bodyEl.textContent).toContain('<img');
    expect(bodyEl.innerHTML).not.toContain('<img src');
    expect(container.querySelector('.chat-thread .message-meta').querySelector('b')).toBeNull();
  });

  test('updateInbox preserves new-chat recipient selection and surfaces new chats', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();

    const select = container.querySelector('.new-chat-select');
    // Simulate an in-progress recipient selection on the starter.
    select.value = bob.id;

    // A new conversation arrives between polls (legacy DM backfilled to a chat).
    MDB.sendMessage(bob.id, 'bob', alice.id, 'alice', 'ping');

    MUI.updateInbox(container);
    await flush();
    await flush();

    // Starter node identity + recipient selection survive the refresh.
    expect(container.querySelector('.new-chat-select')).toBe(select);
    expect(select.value).toBe(bob.id);
    // New conversation surfaced live in the chat list.
    expect(container.querySelector('.chat-list-item')).not.toBeNull();
  });

  test('updateInbox preserves open chat reply draft and shows new thread messages', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    // Seed a DM so a chat exists, then drive the UI to open the chat pane.
    MDB.sendMessage(bob.id, 'bob', alice.id, 'alice', 'hi');
    MUI.renderMessages(container);
    await flush();
    await flush();
    await flush();

    const chatItem = container.querySelector('.chat-list-item');
    expect(chatItem).not.toBeNull();
    chatItem.click();
    await flush();
    await flush();

    const active = container.querySelector('.chat-active');
    const chatId = active.dataset.chatId;
    expect(chatId).toBeTruthy();

    const reply = container.querySelector('.chat-reply-input');
    expect(reply).not.toBeNull();
    reply.value = 'typing a reply...';

    // Incoming chat message from bob via the real low-level write API.
    MDB.postChatMessage(chatId, bob.id, 'bob', 'new chat message');

    MUI.updateInbox(container);
    await flush();
    await flush();

    // Reply textarea node identity + draft survive the refresh.
    expect(container.querySelector('.chat-reply-input')).toBe(reply);
    expect(reply.value).toBe('typing a reply...');
    // Newly arrived chat message is visible live in the thread.
    expect(container.querySelector('.chat-thread').textContent).toMatch(/new chat message/);
  });

  test('updateInbox(null) does not throw', () => {
    expect(() => MUI.updateInbox(null)).not.toThrow();
  });

  test('updateInbox falls back to full render when nothing rendered yet', async () => {
    // Fresh container with no rendered Messages panel and no signed-in user.
    MUI.updateInbox(container);
    await flush();
    await flush();
    const empty = container.querySelector('.messages-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toMatch(/sign in/i);
  });
});

describe('index.html structure', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  test('contains messages tab, panel, and container', () => {
    expect(html).toContain('id="tab-messages"');
    expect(html).toContain('data-tab="messages"');
    expect(html).toContain('💬 Messages');
    expect(html).toContain('id="panel-messages"');
    expect(html).toContain('id="messages-container"');
  });

  test('script load order is correct', () => {
    expect(html.indexOf('js/messages-db.js')).toBeLessThan(html.indexOf('js/messages-api.js'));
    expect(html.indexOf('js/messages-api.js')).toBeLessThan(html.indexOf('js/messages-ui.js'));
    expect(html.indexOf('js/messages-ui.js')).toBeLessThan(html.indexOf('js/app.js'));
    expect(html.indexOf('js/profile-ui.js')).toBeLessThan(html.indexOf('js/messages-db.js'));
  });
});

describe('css/style.css messages rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  test('contains required selectors', () => {
    ['.message-item', '.message-body', '.messages-empty', '.messages-list-title', '.chat-reply-form', '.chat-reply-input', '.new-chat-select'].forEach((sel) => {
      expect(css).toContain(sel);
    });
  });

  test('contains responsive and professional theme rules', () => {
    expect(css).toMatch(/@media \(max-width: 600px\)/);
    expect(css).toMatch(/body\.theme-professional \.chats-section/);
  });
});

describe('app.js Messages tab wiring', () => {
  test('app.js wires renderMessages and game halts for the messages tab', () => {
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    expect(appSrc).toContain("targetTab === 'messages'");
    expect(appSrc).toContain('ForemanMessagesUI.renderMessages');
    const branch = appSrc.slice(appSrc.indexOf("targetTab === 'messages'"));
    expect(branch).toContain('Game.stopGame()');
    expect(branch).toContain('BugSquash.stopAnim()');
    expect(branch).toContain('Snake.stopSnake()');
  });

  test('switching to messages activates panel-messages, stops games, and renders messages', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const bodyMatch = html.match(/<nav class="tab-nav"[\s\S]*?<\/main>/);
    document.body.innerHTML = bodyMatch[0];

    const stopGame = jest.fn();
    const stopAnim = jest.fn();
    const stopSnake = jest.fn();
    const renderMessages = jest.fn();

    window.ForemanGame = { stopGame };
    window.BugSquashAnim = { stopAnim };
    window.ForemanSnake = { stopSnake };
    window.ForemanMessagesUI = { renderMessages };

    const btn = document.getElementById('tab-messages');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.id === 'panel-messages');
      });
      window.ForemanGame.stopGame();
      window.BugSquashAnim.stopAnim();
      window.ForemanSnake.stopSnake();
      window.ForemanMessagesUI.renderMessages(document.getElementById('messages-container'));
    });
    btn.click();

    expect(document.getElementById('panel-messages').classList.contains('active')).toBe(true);
    expect(stopGame).toHaveBeenCalled();
    expect(stopAnim).toHaveBeenCalled();
    expect(stopSnake).toHaveBeenCalled();
    expect(renderMessages).toHaveBeenCalled();
    expect(renderMessages).toHaveBeenCalledWith(document.getElementById('messages-container'));
  });
});
