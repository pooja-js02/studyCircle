import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { authed, connectSocket, findLeaks, registerUser, startServer, waitFor } from './helpers.js';

let srv;
let api;
before(async () => {
  srv = await startServer();
  api = srv.api;
});
after(async () => srv?.stop());

async function makeGroup(owner, body = {}) {
  const res = await authed(api, owner).post('/api/groups').send({ name: 'JEE Physics', tags: ['JEE', 'physics'], ...body }).expect(201);
  return res.body.group;
}

describe('auth (FR-AUTH)', () => {
  it('registers with a Gmail address and a normalised +91 mobile', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'Ana.Test@Gmail.com', mobile: '+91 98111 22233', password: 'password123' })
      .expect(201);
    assert.equal(res.body.user.email, 'ana.test@gmail.com');
    assert.equal(res.body.user.mobile, '+919811122233');
    assert.ok(res.body.token);
  });

  it('rejects bad mobiles, non-Gmail emails, short passwords and duplicates', async () => {
    const base = { name: 'Bo', email: 'bo.unique@gmail.com', mobile: '9811100000', password: 'password123' };
    await api().post('/api/auth/register').send({ ...base, mobile: '5811100000' }).expect(400);
    await api().post('/api/auth/register').send({ ...base, email: 'bo@yahoo.com' }).expect(400);
    await api().post('/api/auth/register').send({ ...base, password: 'short' }).expect(400);
    await api().post('/api/auth/register').send(base).expect(201);
    const dupEmail = await api().post('/api/auth/register').send({ ...base, mobile: '9811100001' }).expect(409);
    assert.equal(dupEmail.body.error.details.field, 'email');
    const dupMobile = await api().post('/api/auth/register').send({ ...base, email: 'bo.other@gmail.com' }).expect(409);
    assert.equal(dupMobile.body.error.details.field, 'mobile');
  });

  it('logs in, and rejects a wrong password or a bad token', async () => {
    const u = await registerUser(api);
    await api().post('/api/auth/login').send({ email: u.email, password: 'nope-nope' }).expect(401);
    const ok = await api().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(200);
    const payload = JSON.parse(Buffer.from(ok.body.token.split('.')[1], 'base64url').toString());
    assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'role', 'sub']); // FR-AUTH-06
    assert.equal(payload.exp - payload.iat, 7 * 24 * 3600); // FR-AUTH-07
    await api().get('/api/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('needs the current password to change the mobile number', async () => {
    const u = await registerUser(api);
    await authed(api, u).patch('/api/me').send({ mobile: '9000011111' }).expect(400);
    await authed(api, u).patch('/api/me').send({ mobile: '9000011111', currentPassword: 'wrong-password' }).expect(401);
    const res = await authed(api, u).patch('/api/me').send({ mobile: '9000011111', currentPassword: u.password }).expect(200);
    assert.equal(res.body.user.mobile, '+919000011111');
  });
});

describe('acceptance 1: role checks hold', () => {
  it('a member cannot approve requests, remove people, edit or delete the group', async () => {
    const admin = await registerUser(api, 'Admin');
    const member = await registerUser(api, 'Member');
    const asker = await registerUser(api, 'Asker');
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, member).post(`/api/groups/${g._id}/join`).expect(201);
    await authed(api, admin).patch(`/api/groups/${g._id}`).send({ privacy: 'approval' }).expect(200);
    const reqRes = await authed(api, asker).post(`/api/groups/${g._id}/requests`).send({}).expect(201);

    const m = authed(api, member);
    await m.get(`/api/groups/${g._id}/requests`).expect(403);
    await m.patch(`/api/groups/${g._id}/requests/${reqRes.body.request._id}`).send({ action: 'approve' }).expect(403);
    await m.delete(`/api/groups/${g._id}/members/${admin._id}`).expect(403);
    await m.patch(`/api/groups/${g._id}`).send({ name: 'Hijacked' }).expect(403);
    await m.delete(`/api/groups/${g._id}`).send({ confirmName: 'JEE Physics' }).expect(403);
    await m.post(`/api/groups/${g._id}/transfer-admin`).send({ userId: member._id }).expect(403);
  });

  it('a member cannot delete someone else’s note, but the admin can', async () => {
    const admin = await registerUser(api);
    const author = await registerUser(api);
    const other = await registerUser(api);
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, author).post(`/api/groups/${g._id}/join`).expect(201);
    await authed(api, other).post(`/api/groups/${g._id}/join`).expect(201);
    const note = (await authed(api, author).post(`/api/groups/${g._id}/notes`).send({ title: 'Torque', content: '# Torque' }).expect(201)).body.note;
    await authed(api, other).delete(`/api/groups/${g._id}/notes/${note._id}`).expect(403);
    await authed(api, other).patch(`/api/groups/${g._id}/notes/${note._id}`).send({ title: 'Mine now' }).expect(403);
    await authed(api, admin).patch(`/api/groups/${g._id}/notes/${note._id}`).send({ title: 'Admin edit' }).expect(403);
    await authed(api, admin).delete(`/api/groups/${g._id}/notes/${note._id}`).expect(204);
  });

  it('a non-member cannot read chat, notes or members', async () => {
    const admin = await registerUser(api);
    const stranger = await registerUser(api);
    const g = await makeGroup(admin);
    const s = authed(api, stranger);
    await s.get(`/api/groups/${g._id}/messages`).expect(403);
    await s.get(`/api/groups/${g._id}/notes`).expect(403);
    await s.get(`/api/groups/${g._id}/members`).expect(403);
  });

  it('the admin cannot leave without transferring admin first', async () => {
    const admin = await registerUser(api);
    const member = await registerUser(api);
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, member).post(`/api/groups/${g._id}/join`).expect(201);
    await authed(api, admin).delete(`/api/groups/${g._id}/members/me`).expect(409);
    await authed(api, admin).post(`/api/groups/${g._id}/transfer-admin`).send({ userId: member._id }).expect(200);
    await authed(api, admin).delete(`/api/groups/${g._id}/members/me`).expect(204);
    await authed(api, member).get(`/api/groups/${g._id}/requests`).expect(200); // new admin
  });
});

describe('acceptance 2: privacy holds', () => {
  it('no email or mobile of anyone else appears in API responses or socket events', async () => {
    const admin = await registerUser(api, 'Priv Admin');
    const viewer = await registerUser(api, 'Priv Viewer');
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, viewer).post(`/api/groups/${g._id}/join`).expect(201);
    await authed(api, admin).post(`/api/groups/${g._id}/notes`).send({ title: 'N', content: 'x' }).expect(201);

    const viewerSocket = await connectSocket(srv.url, viewer);
    const adminSocket = await connectSocket(srv.url, admin);
    const incoming = waitFor(viewerSocket, 'chat:new');
    await new Promise((resolve) => adminSocket.emit('chat:send', { groupId: g._id, text: `hi @${viewer.name}`, mentions: [viewer._id] }, resolve));
    const event = await incoming;

    const v = authed(api, viewer);
    const responses = await Promise.all([
      v.get(`/api/groups/${g._id}`),
      v.get(`/api/groups/${g._id}/members`),
      v.get(`/api/groups/${g._id}/messages`),
      v.get(`/api/groups/${g._id}/notes`),
      v.get('/api/groups/mine'),
      v.get('/api/groups'),
      v.get('/api/notifications'),
      api().get(`/api/groups/${g._id}`),
    ]);
    const leaks = findLeaks([event, ...responses.map((r) => r.body)], [admin.email, admin.mobile, admin.mobile.slice(3)]);
    assert.deepEqual(leaks, []);
    viewerSocket.close();
    adminSocket.close();
  });
});

describe('acceptance 3: join flow', () => {
  it('request → live alert to admin → approve → requester gets in without reload', async () => {
    const admin = await registerUser(api);
    const asker = await registerUser(api, 'Karan');
    const g = await makeGroup(admin);
    const adminSocket = await connectSocket(srv.url, admin);
    const askerSocket = await connectSocket(srv.url, asker);

    const alert = waitFor(adminSocket, 'request:new');
    const created = await authed(api, asker).post(`/api/groups/${g._id}/requests`).send({ message: 'Same batch' }).expect(201);
    assert.equal((await alert).request.message, 'Same batch');
    await authed(api, asker).post(`/api/groups/${g._id}/requests`).send({}).expect(409); // FR-REQ-02

    const card = await authed(api, asker).get(`/api/groups?search=${encodeURIComponent('JEE Physics')}`);
    assert.equal(card.body.groups.find((x) => x._id === g._id).myState, 'pending');

    const reviewed = waitFor(askerSocket, 'request:reviewed');
    await authed(api, admin).patch(`/api/groups/${g._id}/requests/${created.body.request._id}`).send({ action: 'approve' }).expect(200);
    assert.equal((await reviewed).status, 'approved');

    // The requester's existing socket now receives the group's chat
    const live = waitFor(askerSocket, 'chat:new');
    await new Promise((resolve) => adminSocket.emit('chat:send', { groupId: g._id, text: 'welcome!' }, resolve));
    assert.equal((await live).message.text, 'welcome!');
    await authed(api, asker).get(`/api/groups/${g._id}/notes`).expect(200);
    adminSocket.close();
    askerSocket.close();
  });

  it('rejection blocks a new request for 7 days, and a second rejection later still works', async () => {
    const admin = await registerUser(api);
    const asker = await registerUser(api);
    const g = await makeGroup(admin);
    const a = authed(api, asker);
    const first = await a.post(`/api/groups/${g._id}/requests`).send({}).expect(201);
    await authed(api, admin).patch(`/api/groups/${g._id}/requests/${first.body.request._id}`).send({ action: 'reject' }).expect(200);
    const blocked = await a.post(`/api/groups/${g._id}/requests`).send({}).expect(409);
    assert.ok(blocked.body.error.details.retryAt);

    // Move the rejection 8 days into the past and try again
    const JoinRequest = mongoose.model('JoinRequest');
    await JoinRequest.updateOne({ _id: first.body.request._id }, { reviewedAt: new Date(Date.now() - 8 * 86400000) });
    const second = await a.post(`/api/groups/${g._id}/requests`).send({}).expect(201);
    await authed(api, admin).patch(`/api/groups/${g._id}/requests/${second.body.request._id}`).send({ action: 'reject' }).expect(200);
    assert.equal(await JoinRequest.countDocuments({ group: g._id, user: asker._id, status: 'rejected' }), 2);
  });

  it('removing a member ends their access at once', async () => {
    const admin = await registerUser(api);
    const member = await registerUser(api);
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, member).post(`/api/groups/${g._id}/join`).expect(201);
    const memberSocket = await connectSocket(srv.url, member);
    const removed = waitFor(memberSocket, 'member:removed');
    await authed(api, admin).delete(`/api/groups/${g._id}/members/${member._id}`).expect(204);
    assert.equal((await removed).reason, 'removed');
    await authed(api, member).get(`/api/groups/${g._id}/messages`).expect(403);
    const ack = await new Promise((resolve) => memberSocket.emit('chat:send', { groupId: g._id, text: 'still here?' }, resolve));
    assert.equal(ack.ok, false);
    memberSocket.close();
  });
});

describe('invite-only groups (FR-GRP-17)', () => {
  it('are hidden from search and preview, and open through the invite code', async () => {
    const admin = await registerUser(api);
    const guest = await registerUser(api);
    const g = await makeGroup(admin, { name: 'Secret Squad', privacy: 'invite' });
    assert.match(g.inviteCode, /^[A-Z2-9]{6}$/);
    const search = await authed(api, guest).get('/api/groups?search=Secret');
    assert.equal(search.body.groups.length, 0);
    await authed(api, guest).get(`/api/groups/${g._id}`).expect(404);
    await authed(api, guest).post(`/api/groups/${g._id}/requests`).send({}).expect(404);
    const preview = await authed(api, guest).get(`/api/groups/invite/${g.inviteCode.toLowerCase()}`).expect(200);
    assert.equal(preview.body.group.inviteCode, undefined);
    await authed(api, guest).post(`/api/groups/join/${g.inviteCode}`).expect(201);
    await authed(api, guest).get(`/api/groups/${g._id}`).expect(200);
  });
});

describe('acceptance 4 + 5: many groups and mentions', () => {
  it('unread counts and mention badges work across 3 groups; @everyone is admin-only', async () => {
    const me = await registerUser(api, 'Mia');
    const other = await registerUser(api, 'Omar');
    const groups = [];
    for (const name of ['G One', 'G Two', 'G Three']) {
      const g = await makeGroup(other, { name, privacy: 'open' });
      await authed(api, me).post(`/api/groups/${g._id}/join`).expect(201);
      groups.push(g);
    }
    const mine = await connectSocket(srv.url, me);
    const theirs = await connectSocket(srv.url, other);

    const mention = waitFor(mine, 'mention:new');
    const send = (payload) => new Promise((resolve) => theirs.emit('chat:send', payload, resolve));
    await send({ groupId: groups[0]._id, text: 'plain message' });
    await send({ groupId: groups[1]._id, text: `@${me.name} look`, mentions: [me._id, new mongoose.Types.ObjectId().toString()] });
    await send({ groupId: groups[2]._id, text: '@everyone test tomorrow' });
    const m = await mention;
    assert.equal(m.groupId, groups[1]._id);

    const sidebar = (await authed(api, me).get('/api/groups/mine').expect(200)).body.groups;
    const byName = Object.fromEntries(sidebar.map((g) => [g.name, g]));
    assert.equal(byName['G One'].unreadCount, 1);
    assert.equal(byName['G One'].mentionCount, 0);
    assert.equal(byName['G Two'].mentionCount, 1);
    assert.equal(byName['G Three'].mentionCount, 1); // admin's @everyone counts

    // Non-member IDs are dropped from mentions (FR-CHAT-06)
    const msgs = (await authed(api, me).get(`/api/groups/${groups[1]._id}/messages`).expect(200)).body.messages;
    assert.deepEqual(msgs.at(-1).mentions, [me._id]);

    // A member's @everyone does not notify anyone (FR-CHAT-10)
    const ack = await new Promise((resolve) => mine.emit('chat:send', { groupId: groups[0]._id, text: '@everyone hi' }, resolve));
    assert.equal(ack.ok, true);
    assert.equal(ack.message.mentionsEveryone, false);

    // Opening at a mention (FR-CHAT-09)
    const around = await authed(api, me).get(`/api/groups/${groups[1]._id}/messages?around=${m.messageId}`).expect(200);
    assert.ok(around.body.messages.some((x) => x._id === m.messageId));

    const notifs = await authed(api, me).get('/api/notifications').expect(200);
    assert.equal(notifs.body.notifications.filter((n) => n.type === 'mention').length, 2);
    const read = await authed(api, me).patch('/api/notifications/read').send({}).expect(200);
    assert.equal(read.body.unreadCount, 0);
    mine.close();
    theirs.close();
  });

  it('rejects messages over 2,000 characters and lets the admin remove a message', async () => {
    const admin = await registerUser(api);
    const g = await makeGroup(admin);
    const s = await connectSocket(srv.url, admin);
    const tooLong = await new Promise((resolve) => s.emit('chat:send', { groupId: g._id, text: 'x'.repeat(2001) }, resolve));
    assert.equal(tooLong.ok, false);
    const ok = await new Promise((resolve) => s.emit('chat:send', { groupId: g._id, text: 'oops' }, resolve));
    await authed(api, admin).delete(`/api/groups/${g._id}/messages/${ok.message._id}`).expect(204);
    const msgs = (await authed(api, admin).get(`/api/groups/${g._id}/messages`)).body.messages;
    const removed = msgs.find((x) => x._id === ok.message._id);
    assert.equal(removed.isDeleted, true);
    assert.equal(removed.text, null);
    s.close();
  });
});

describe('acceptance 6: notes', () => {
  const pdf = (bytes) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes - 9, 0x20)]);

  it('a 10 MB PDF uploads and streams back; 11 MB and .exe files are refused', async () => {
    const admin = await registerUser(api);
    const g = await makeGroup(admin);
    const a = authed(api, admin);
    const ok = await a
      .post(`/api/groups/${g._id}/notes`)
      .field('title', 'Rotational PYQs')
      .field('folder', 'Mechanics')
      .field('tags', 'pyq, rotation')
      .attach('file', pdf(10 * 1024 * 1024), 'pyqs.pdf')
      .expect(201);
    assert.equal(ok.body.note.fileType, 'pdf');
    assert.deepEqual(ok.body.note.tags, ['pyq', 'rotation']);

    const file = await a.get(`/api/groups/${g._id}/notes/${ok.body.note._id}/file`).expect(200);
    assert.equal(file.headers['content-type'], 'application/pdf');

    const big = await a.post(`/api/groups/${g._id}/notes`).field('title', 'Big').attach('file', pdf(11 * 1024 * 1024), 'big.pdf').expect(400);
    assert.match(big.body.error.message, /10 MB/);
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 1)]);
    await a.post(`/api/groups/${g._id}/notes`).field('title', 'Virus').attach('file', exe, 'notes.pdf').expect(400);

    const search = await a.get(`/api/groups/${g._id}/notes?search=rotational&folder=Mechanics`).expect(200);
    assert.equal(search.body.notes.length, 1);
  });
});

describe('note deletion rights and explanation videos', () => {
  // Smallest bytes file-type recognises as MP4: an ftyp box with the "mp42" brand
  const mp4 = (bytes) => {
    const head = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d]);
    return Buffer.concat([head, Buffer.alloc(bytes - head.length, 0)]);
  };

  async function setup() {
    const admin = await registerUser(api, 'Del Admin');
    const uploader = await registerUser(api, 'Del Uploader');
    const member = await registerUser(api, 'Del Member');
    const outsider = await registerUser(api, 'Del Outsider');
    const superadmin = await registerUser(api, 'Platform Owner');
    await mongoose.model('User').updateOne({ _id: superadmin._id }, { platformRole: 'superadmin' });
    const g = await makeGroup(admin, { privacy: 'open' });
    await authed(api, uploader).post(`/api/groups/${g._id}/join`).expect(201);
    await authed(api, member).post(`/api/groups/${g._id}/join`).expect(201);
    const addNote = async (title) =>
      (await authed(api, uploader).post(`/api/groups/${g._id}/notes`).send({ title, content: 'x' }).expect(201)).body.note;
    return { admin, uploader, member, outsider, superadmin, g, addNote };
  }

  it('uploader, group admin and superadmin can delete; other members and outsiders cannot', async () => {
    const { admin, uploader, member, outsider, superadmin, g, addNote } = await setup();
    const [n1, n2, n3] = [await addNote('one'), await addNote('two'), await addNote('three')];

    await authed(api, member).delete(`/api/groups/${g._id}/notes/${n1._id}`).expect(403);
    await authed(api, outsider).delete(`/api/groups/${g._id}/notes/${n1._id}`).expect(403);

    await authed(api, uploader).delete(`/api/groups/${g._id}/notes/${n1._id}`).expect(204);
    await authed(api, admin).delete(`/api/groups/${g._id}/notes/${n2._id}`).expect(204);
    // The superadmin is not a member of this group, and can still read and remove notes
    await authed(api, superadmin).get(`/api/groups/${g._id}/notes`).expect(200);
    await authed(api, superadmin).delete(`/api/groups/${g._id}/notes/${n3._id}`).expect(204);
    // ...but cannot post into a group they have not joined
    await authed(api, superadmin).post(`/api/groups/${g._id}/notes`).send({ title: 'x', content: 'x' }).expect(403);
  });

  it('accepts explanation videos up to 100 MB, streams them with ranges, and limits documents to 10 MB', async () => {
    const { uploader, outsider, g } = await setup();
    const u = authed(api, uploader);
    const video = await u
      .post(`/api/groups/${g._id}/notes`)
      .field('title', 'Parallel axis explained')
      .attach('file', mp4(12 * 1024 * 1024), 'explain.mp4')
      .expect(201);
    assert.equal(video.body.note.fileType, 'mp4');

    const pdfBig = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(12 * 1024 * 1024)]);
    const refused = await u.post(`/api/groups/${g._id}/notes`).field('title', 'Too big').attach('file', pdfBig, 'big.pdf').expect(400);
    assert.match(refused.body.error.message, /10 MB/);

    // Short-lived link for <video src>, with byte ranges for seeking
    const link = (await u.get(`/api/groups/${g._id}/notes/${video.body.note._id}/file-link`).expect(200)).body.url;
    const part = await api().get(link).set('Range', 'bytes=0-99').expect(206);
    assert.equal(part.headers['content-range'], `bytes 0-99/${12 * 1024 * 1024}`);
    assert.equal(part.headers['content-type'], 'video/mp4');
    await api().get('/api/files/not-a-token').expect(401);

    // The link is personal: an outsider's own link cannot be made, and session tokens don't work as file links
    await authed(api, outsider).get(`/api/groups/${g._id}/notes/${video.body.note._id}/file-link`).expect(403);
    await api().get(`/api/files/${uploader.token}`).expect(401);
  });
});
