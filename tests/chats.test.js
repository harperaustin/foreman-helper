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
  MDB.clearAllChats();
});

describe('ForemanMessagesDB chats', () => {
  test('generateChatId matches chat_ + 8 hex', () => {
    expect(MDB.generateChatId()).toMatch(/^chat_[0-9a-f]{8}$/);
  });

  test('getOrCreateChat creates a chat with sorted participants', () => {
    const chat = MDB.getOrCreateChat(['b', 'a']);
    expect(chat.id).toMatch(/^chat_[0-9a-f]{8}$/);
    expect(chat.participants).toEqual(['a', 'b']);
    expect(chat.isGroup).toBe(false);
    const group = MDB.getOrCreateChat(['a', 'b', 'c']);
    expect(group.participants).toEqual(['a', 'b', 'c']);
    expect(group.isGroup).toBe(true);
  });

  test('getOrCreateChat returns the same chat for a reordered participant set', () => {
    const first = MDB.getOrCreateChat(['a', 'b']);
    const second = MDB.getOrCreateChat(['b', 'a']);
    expect(second.id).toBe(first.id);
    expect(MDB.loadChats().length).toBe(1);
  });

  test('getOrCreateChat dedupes group chats regardless of order', () => {
    const first = MDB.getOrCreateChat(['a', 'b', 'c']);
    const second = MDB.getOrCreateChat(['c', 'a', 'b']);
    expect(second.id).toBe(first.id);
    expect(MDB.loadChats().length).toBe(1);
  });

  test('getOrCreateChat creates a new chat for different membership', () => {
    const direct = MDB.getOrCreateChat(['a', 'b']);
    const group = MDB.getOrCreateChat(['a', 'b', 'c']);
    expect(group.id).not.toBe(direct.id);
    expect(MDB.loadChats().length).toBe(2);
  });

  test('getOrCreateChat throws for fewer than two participants', () => {
    expect(() => MDB.getOrCreateChat(['a'])).toThrow(/two participants/i);
    expect(() => MDB.getOrCreateChat([])).toThrow(/two participants/i);
    // duplicate ids collapse to a single participant
    expect(() => MDB.getOrCreateChat(['a', 'a'])).toThrow(/two participants/i);
  });

  test('findChatByParticipants is order-independent and returns null when absent', () => {
    expect(MDB.findChatByParticipants(['a', 'b'])).toBeNull();
    const chat = MDB.getOrCreateChat(['a', 'b']);
    expect(MDB.findChatByParticipants(['b', 'a']).id).toBe(chat.id);
    expect(MDB.findChatByParticipants(['a', 'z'])).toBeNull();
  });

  test('getChat returns the record or null for unknown id', () => {
    const chat = MDB.getOrCreateChat(['a', 'b']);
    expect(MDB.getChat(chat.id).id).toBe(chat.id);
    expect(MDB.getChat('chat_deadbeef')).toBeNull();
  });

  test('listChats returns only chats containing the user', () => {
    MDB.getOrCreateChat(['a', 'b']);
    MDB.getOrCreateChat(['b', 'c']);
    MDB.getOrCreateChat(['x', 'y']);
    const forA = MDB.listChats('a');
    expect(forA.length).toBe(1);
    expect(forA[0].participants).toEqual(['a', 'b']);
    const forB = MDB.listChats('b');
    expect(forB.length).toBe(2);
  });

  test('postChatMessage stores a chatId group message excluded from getInbox', () => {
    const chat = MDB.getOrCreateChat(['a', 'b', 'c']);
    const rec = MDB.postChatMessage(chat.id, 'a', 'alice', 'team hello');
    expect(rec.chatId).toBe(chat.id);
    expect(rec.toId).toBe('');
    const msgs = MDB.getChatMessages(chat.id);
    expect(msgs.length).toBe(1);
    expect(msgs[0].body).toBe('team hello');
    // group messages have no single recipient, so they never pollute inboxes
    expect(MDB.getInbox('b').length).toBe(0);
    expect(MDB.getInbox('c').length).toBe(0);
  });

  test('postChatMessage on a direct chat keeps the other participant as recipient', () => {
    const chat = MDB.getOrCreateChat(['a', 'b']);
    const rec = MDB.postChatMessage(chat.id, 'a', 'alice', 'hi bob');
    expect(rec.chatId).toBe(chat.id);
    expect(rec.toId).toBe('b');
    // direct replies still surface in the legacy inbox/sent views
    expect(MDB.getInbox('b').length).toBe(1);
    expect(MDB.getSent('a').length).toBe(1);
  });

  test('postChatMessage throws Chat not found for unknown chatId', () => {
    expect(() => MDB.postChatMessage('chat_missing', 'a', 'alice', 'hi')).toThrow(/not found/i);
  });

  test('postChatMessage throws when sender is not a participant', () => {
    const chat = MDB.getOrCreateChat(['a', 'b']);
    expect(() => MDB.postChatMessage(chat.id, 'c', 'carol', 'hi')).toThrow(/participant/i);
  });

  test('postChatMessage throws on empty body', () => {
    const chat = MDB.getOrCreateChat(['a', 'b']);
    expect(() => MDB.postChatMessage(chat.id, 'a', 'alice', '   ')).toThrow(/required/i);
  });

  test('getChatMessages returns messages oldest-first', () => {
    const chat = MDB.getOrCreateChat(['a', 'b']);
    const r1 = MDB.postChatMessage(chat.id, 'a', 'alice', 'one');
    const r2 = MDB.postChatMessage(chat.id, 'b', 'bob', 'two');
    const r3 = MDB.postChatMessage(chat.id, 'a', 'alice', 'three');
    const msgs = MDB.getChatMessages(chat.id);
    expect(msgs.map((m) => m.id)).toEqual([r1.id, r2.id, r3.id]);
    expect(msgs[0].createdAt <= msgs[2].createdAt).toBe(true);
  });

  test('getChatMessages returns [] for unknown chatId', () => {
    expect(MDB.getChatMessages('chat_nope')).toEqual([]);
  });

  test('listChats backfills a chat for preexisting 1:1 messages (legacy history)', () => {
    // legacy message sent before any chat existed (5-arg, chatId null)
    const legacy = MDB.sendMessage('a', 'alice', 'b', 'bob', 'hi from the past');
    expect(legacy.chatId).toBeNull();
    const chats = MDB.listChats('a');
    expect(chats.length).toBe(1);
    expect(chats[0].participants).toEqual(['a', 'b']);
    const history = MDB.getChatMessages(chats[0].id);
    expect(history.some((m) => m.body === 'hi from the past')).toBe(true);
  });

  test('loadChats returns [] for corrupt storage', () => {
    localStorage.setItem(MDB.CHATS_KEY, 'not json');
    expect(MDB.loadChats()).toEqual([]);
  });

  test('sendMessage still works and accepts optional chatId', () => {
    const noChat = MDB.sendMessage('a', 'A', 'b', 'B', 'hi');
    expect(noChat.chatId).toBeNull();
    const withChat = MDB.sendMessage('a', 'A', 'b', 'B', 'hi', 'chat_12345678');
    expect(withChat.chatId).toBe('chat_12345678');
  });
});

describe('ForemanMessagesAPI chats', () => {
  let aliceId, bobId, carolId;

  beforeEach(async () => {
    const alice = await PAPI.register('alice', 'password1');
    aliceId = alice.id;
    bobId = PDB.createUser('bob', 'password1').id;
    carolId = PDB.createUser('carol', 'password1').id;
  });

  test('createGroupChat rejects when not signed in', async () => {
    sessionStorage.clear();
    await expect(MAPI.createGroupChat([bobId, carolId])).rejects.toThrow(/signed in/i);
  });

  test('createGroupChat requires at least two other people', async () => {
    await expect(MAPI.createGroupChat([bobId])).rejects.toThrow(/two/i);
  });

  test('createGroupChat creates a >2 participant chat', async () => {
    const chat = await MAPI.createGroupChat([bobId, carolId]);
    expect(chat.isGroup).toBe(true);
    expect(chat.participants.length).toBe(3);
    expect(chat.participants).toContain(aliceId);
  });

  test('createGroupChat with the same set returns the existing chat (no duplicate)', async () => {
    const first = await MAPI.createGroupChat([bobId, carolId]);
    const second = await MAPI.createGroupChat([carolId, bobId]);
    expect(second.id).toBe(first.id);
    expect(MDB.loadChats().length).toBe(1);
  });

  test('openDirectChat creates/reuses a 1:1 chat', async () => {
    const first = await MAPI.openDirectChat(bobId);
    const second = await MAPI.openDirectChat(bobId);
    expect(second.id).toBe(first.id);
    expect(MDB.loadChats().length).toBe(1);
  });

  test('openChat rejects unknown participant ids', async () => {
    await expect(MAPI.openChat(['usr_doesnotexist'])).rejects.toThrow(/unknown|participant/i);
  });

  test('send() creates/reuses the 1:1 chat and stamps chatId', async () => {
    const rec = await MAPI.send(bobId, 'bob', 'hello');
    expect(rec.chatId).toBeTruthy();
    expect(MDB.loadChats().length).toBe(1);
    const again = await MAPI.send(bobId, 'bob', 'again');
    expect(again.chatId).toBe(rec.chatId);
    expect(MDB.loadChats().length).toBe(1);
  });

  test('listChats shows the direct chat created by send() immediately', async () => {
    await MAPI.send(bobId, 'bob', 'hello');
    const chats = await MAPI.listChats();
    const found = chats.find((c) => c.participantUsernames.indexOf('bob') >= 0);
    expect(found).toBeTruthy();
  });

  test('chatMessages rejects a non-participant', async () => {
    const chat = await MAPI.createGroupChat([bobId, carolId]);
    const dave = await PAPI.register('dave', 'password1');
    await expect(MAPI.chatMessages(chat.id)).rejects.toThrow(/participant/i);
    expect(dave.id).not.toBe(aliceId);
  });

  test('sendToChat rejects a non-participant', async () => {
    const chat = await MAPI.createGroupChat([bobId, carolId]);
    await PAPI.register('dave', 'password1');
    await expect(MAPI.sendToChat(chat.id, 'hi')).rejects.toThrow(/participant/i);
  });

  test('chatMessages rejects an unknown chatId', async () => {
    await expect(MAPI.chatMessages('chat_unknown')).rejects.toThrow(/not found/i);
  });

  test('sendToChat rejects an unknown chatId', async () => {
    await expect(MAPI.sendToChat('chat_unknown', 'hi')).rejects.toThrow(/not found/i);
  });

  test('sendToChat and chatMessages round-trip for a participant', async () => {
    const chat = await MAPI.createGroupChat([bobId, carolId]);
    await MAPI.sendToChat(chat.id, '  hi team  ');
    const msgs = await MAPI.chatMessages(chat.id);
    expect(msgs.length).toBe(1);
    expect(msgs[0].body).toBe('hi team');
  });

  test('sendToChat rejects empty body', async () => {
    const chat = await MAPI.createGroupChat([bobId, carolId]);
    await expect(MAPI.sendToChat(chat.id, '   ')).rejects.toThrow(/required/i);
  });

  test('listChats returns enriched chats with participantUsernames', async () => {
    await MAPI.createGroupChat([bobId, carolId]);
    const chats = await MAPI.listChats();
    expect(chats.length).toBe(1);
    expect(chats[0].participantUsernames).toEqual(expect.arrayContaining(['bob', 'carol']));
  });

  test('direct reply sent from a chat thread still appears in the legacy inbox', async () => {
    const chat = await MAPI.openDirectChat(bobId);
    await MAPI.sendToChat(chat.id, 'inbox me');
    // bob should see the reply in his legacy inbox
    expect(MDB.getInbox(bobId).length).toBe(1);
    // and in the API inbox view
    setSession(bobId);
    const bobInbox = await MAPI.inbox();
    expect(bobInbox.some((m) => m.body === 'inbox me')).toBe(true);
  });

  function setSession(userId) {
    const user = PDB.getUser(userId);
    sessionStorage.setItem(PAPI.SESSION_KEY, JSON.stringify(user));
  }
});

describe('ForemanMessagesUI chats', () => {
  let container;
  const flush = () => new Promise((r) => setTimeout(r, MAPI.NETWORK_DELAY * 4 + 50));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  test('signed-out still shows only the sign-in prompt, no chat section', async () => {
    MUI.renderMessages(container);
    await flush();
    expect(container.querySelector('.chats-section')).toBeNull();
    const empty = container.querySelector('.messages-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toMatch(/sign in/i);
  });

  test('renders a chat section with a group-create select for the signed-in user', async () => {
    await PAPI.register('alice', 'password1');
    PDB.createUser('bob', 'password1');
    PDB.createUser('carol', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    expect(container.querySelector('.chats-section')).not.toBeNull();
    const select = container.querySelector('.chat-group-select');
    expect(select).not.toBeNull();
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts).toContain('bob');
    expect(optionTexts).toContain('carol');
    expect(optionTexts).not.toContain('alice');
  });

  test('sending via the legacy composer creates a chat, lists it, and opens its thread', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    const select = container.querySelector('.messages-form select');
    const textarea = container.querySelector('.messages-body');
    select.value = bob.id;
    textarea.value = 'hello bob';
    container.querySelector('.messages-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    await flush();
    expect(container.querySelector('.chat-list-item')).not.toBeNull();
    const thread = container.querySelector('.chat-active .chat-thread');
    expect(thread).not.toBeNull();
    expect(thread.querySelector('.message-item')).not.toBeNull();
  });

  test('creating a group chat shows it in the chat list and opens its thread', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    const carol = PDB.createUser('carol', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    const groupForm = container.querySelector('.chat-group-form');
    const select = container.querySelector('.chat-group-select');
    Array.from(select.options).forEach((o) => {
      if (o.value === bob.id || o.value === carol.id) o.selected = true;
    });
    groupForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    await flush();
    expect(container.querySelector('.chat-list-item')).not.toBeNull();
    const banner = container.querySelector('.chat-group-form .success-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toMatch(/ready|group/i);
  });

  test('does not create duplicate group chats for the same set', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    const carol = PDB.createUser('carol', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    const groupForm = container.querySelector('.chat-group-form');
    const select = container.querySelector('.chat-group-select');
    const selectBoth = () => Array.from(select.options).forEach((o) => {
      o.selected = (o.value === bob.id || o.value === carol.id);
    });
    selectBoth();
    groupForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    selectBoth();
    groupForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    await flush();
    expect(MDB.loadChats().length).toBe(1);
    expect(container.querySelectorAll('.chat-list-item').length).toBe(1);
  });

  test('opening a chat shows history oldest-first and reply sends with success banner', async () => {
    const alice = await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    const carol = PDB.createUser('carol', 'password1');
    const chat = await MAPI.createGroupChat([bob.id, carol.id]);
    await MAPI.sendToChat(chat.id, 'first message');
    MUI.renderMessages(container);
    await flush();
    await flush();
    const item = container.querySelector('.chat-list-item');
    expect(item).not.toBeNull();
    item.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    const msgItems = container.querySelectorAll('.chat-thread .message-item');
    expect(msgItems.length).toBe(1);
    expect(msgItems[0].classList.contains('chat-msg-own')).toBe(true);
    expect(alice.id).toBeTruthy();

    const replyInput = container.querySelector('.chat-reply-input');
    replyInput.value = 'second message';
    container.querySelector('.chat-reply-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    const banner = container.querySelector('.chat-active .success-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toMatch(/sent/i);
    expect(container.querySelector('.chat-reply-input').value).toBe('');
  });

  test('chat messages render body/username as text not HTML (XSS)', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    const carol = PDB.createUser('carol', 'password1');
    const chat = await MAPI.createGroupChat([bob.id, carol.id]);
    await MAPI.sendToChat(chat.id, '<img src=x onerror=alert(1)>');
    MUI.renderMessages(container);
    await flush();
    await flush();
    container.querySelector('.chat-list-item').dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    const bodyEl = container.querySelector('.chat-thread .message-body');
    expect(bodyEl).not.toBeNull();
    expect(bodyEl.querySelector('img')).toBeNull();
    expect(bodyEl.textContent).toContain('<img');
    expect(bodyEl.innerHTML).not.toContain('<img src');
  });

  test('legacy composer still works alongside chats', async () => {
    await PAPI.register('alice', 'password1');
    const bob = PDB.createUser('bob', 'password1');
    MUI.renderMessages(container);
    await flush();
    await flush();
    // composer select is the first select in DOM order
    const firstSelect = container.querySelector('select');
    expect(firstSelect.className).toContain('messages-input');
    expect(firstSelect.hasAttribute('multiple')).toBe(false);
    firstSelect.value = bob.id;
    container.querySelector('.messages-body').value = 'hi via legacy';
    container.querySelector('.messages-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    const banner = container.querySelector('.messages-form .success-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toMatch(/sent/i);
  });
});

describe('chats source contracts', () => {
  test('css contains chat selectors and preserves contracts', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    ['.chats-section', '.chat-group-select', '.chat-list-item', '.chat-thread', '.chat-msg-own', '.chat-msg-other', '.chat-reply-form', '.chat-reply-input'].forEach((sel) => {
      expect(css).toContain(sel);
    });
    expect(css).toMatch(/@media \(max-width: 600px\)/);
    expect(css).toMatch(/body\.theme-professional \.messages-form/);
  });
});
