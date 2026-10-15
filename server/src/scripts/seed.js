// Fills the database with demo users, groups, chat and notes so a visitor sees a lived-in app.
// Usage: npm run seed            (skips if demo data exists)
//        npm run seed -- --reset (wipes everything first)
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Group, JoinRequest, Membership, Message, Note, Notification, User } from '../models/index.js';
import { generateInviteCode } from '../utils/inviteCode.js';
import { BCRYPT_COST } from '../controllers/authController.js';

export const DEMO_EMAIL = 'demo.ananya@gmail.com';
export const DEMO_PASSWORD = 'studycircle';

const people = [
  { key: 'ananya', name: 'Ananya Gupta', email: DEMO_EMAIL, mobile: '+919876543210' },
  { key: 'rahul', name: 'Rahul Verma', email: 'demo.rahul@gmail.com', mobile: '+919812342190' },
  { key: 'priya', name: 'Priya Sharma', email: 'demo.priya@gmail.com', mobile: '+919823456781' },
  { key: 'aman', name: 'Aman Gill', email: 'demo.aman@gmail.com', mobile: '+919834567812' },
  { key: 'simran', name: 'Simran Kaur', email: 'demo.simran@gmail.com', mobile: '+919845678123' },
  { key: 'karan', name: 'Karan Malhotra', email: 'demo.karan@gmail.com', mobile: '+919856781234' },
  { key: 'neha', name: 'Neha Kapoor', email: 'demo.neha@gmail.com', mobile: '+919867812345' },
  { key: 'ishaan', name: 'Ishaan Rao', email: 'demo.ishaan@gmail.com', mobile: '+919878123456' },
  { key: 'meera', name: 'Meera Krishnan', email: 'demo.meera@gmail.com', mobile: '+917881234567' },
];

const groups = [
  {
    key: 'jeephy', name: 'JEE Physics ’26', privacy: 'approval', admin: 'ananya',
    description: 'Daily PYQ grind for mechanics and electrostatics. Same Ludhiana batch.',
    tags: ['jee', 'physics'], members: ['rahul', 'priya', 'aman', 'simran'],
  },
  {
    key: 'neetbio', name: 'NEET Biology', privacy: 'approval', admin: 'simran',
    description: 'NCERT line-by-line biology with daily 20-question drills.',
    tags: ['neet', 'biology'], members: ['ananya', 'neha', 'meera'],
  },
  {
    key: 'jeemaths', name: 'JEE Maths Marathon', privacy: 'approval', admin: 'ishaan',
    description: 'Calculus and coordinate geometry, one chapter a week with timed Sunday tests.',
    tags: ['jee', 'maths'], members: ['meera', 'karan', 'rahul'],
  },
  {
    key: 'organic', name: 'Organic Chem Night Owls', privacy: 'open', admin: 'priya',
    description: 'Late-night reaction mechanisms and named reactions revision.',
    tags: ['jee', 'neet', 'chemistry'], members: ['aman', 'neha'],
  },
  {
    key: 'upsc', name: 'UPSC GS Prelims', privacy: 'open', admin: 'karan',
    description: 'Polity, economy and current affairs. One chapter of Laxmikanth a day.',
    tags: ['upsc', 'polity'], members: ['ananya', 'ishaan'],
  },
  {
    key: 'gate', name: 'GATE CSE Squad', privacy: 'approval', admin: 'aman',
    description: 'Previous-year GATE CSE papers, OS and DBMS deep dives every weekend.',
    tags: ['gate', 'cse'], members: ['rahul'],
  },
  {
    key: 'droppers', name: 'Droppers 2026 Circle', privacy: 'approval', admin: 'meera',
    description: 'Accountability for repeaters: daily targets, weekly reviews, no judgement.',
    tags: ['jee', 'dropper'], members: ['karan', 'neha', 'simran'],
  },
];

const chat = {
  jeephy: [
    ['rahul', 'Uploaded the rotational motion PYQs. Q12 has a trap with the axis — moment of inertia is about the edge, not the centre.'],
    ['priya', '@Ananya Gupta can you explain why the parallel axis theorem applies here? I keep getting ML²/12.', ['ananya']],
    ['ananya', 'Because the rod rotates about its end. Shift the axis by L/2: I = ML²/12 + M(L/2)² = ML²/3.'],
    ['aman', 'That clicked. Doing the next three from the same set tonight.'],
    ['simran', 'Can we do electrostatics on Saturday? Gauss law problems still feel shaky.'],
    ['rahul', '@Ananya Gupta check Q12 again, the answer key in the book is wrong.', ['ananya']],
  ],
  neetbio: [
    ['simran', 'Today: Plant Kingdom, pages 29–38. Drill posted in notes.'],
    ['neha', 'Bryophytes vs pteridophytes table is in the notes now.'],
    ['meera', '@Ananya Gupta you had a mnemonic for the alternation of generations?', ['ananya']],
  ],
  upsc: [
    ['karan', 'New note: Polity ch. 4 — Fundamental Rights summary.'],
    ['ishaan', 'Article 21 case list added at the end.'],
  ],
  jeemaths: [['ishaan', 'Sunday test is on definite integrals. 45 minutes, 15 questions.']],
  organic: [['priya', 'Tonight: aldol and Cannizzaro. Bring your doubts.']],
  gate: [['aman', 'OS scheduling PYQs from 2015–2024 are up.']],
  droppers: [['meera', 'Weekly check-in: post your three targets for this week.']],
};

const notes = {
  jeephy: [
    ['rahul', 'Rotational motion PYQ notes', 'Mechanics', ['rotation', 'pyq'], '# Rotational motion — PYQ traps\n\n- **Parallel axis:** I = I_cm + Md²\n- Rod about its end: **ML²/3**\n- Rod about its centre: **ML²/12**\n\n> Always check which axis the question uses.'],
    ['priya', 'Torque cheat sheet', 'Mechanics', ['torque'], '# Torque\n\n| Quantity | Formula |\n| --- | --- |\n| Torque | τ = r × F |\n| Angular momentum | L = Iω |\n| Work | W = τθ |'],
    ['aman', 'Gauss law checklist', 'Electrostatics', ['gauss', 'electrostatics'], '# Gauss law\n\n1. Pick a surface with symmetry\n2. Find enclosed charge\n3. Φ = q_enc / ε₀'],
  ],
  neetbio: [
    ['neha', 'Bryophytes vs pteridophytes', 'Plant Kingdom', ['ncert', 'botany'], '# Bryophytes vs pteridophytes\n\n| | Bryophytes | Pteridophytes |\n| --- | --- | --- |\n| Dominant phase | Gametophyte | Sporophyte |\n| Vascular tissue | Absent | Present |'],
  ],
  upsc: [
    ['karan', 'Polity ch. 4 — Fundamental Rights', 'Polity', ['laxmikanth', 'rights'], '# Fundamental Rights (Part III)\n\n- Articles 12–35\n- Six rights after the 44th Amendment\n- Right to property moved to Article 300A'],
  ],
};

async function main() {
  await connectDb();
  const reset = process.argv.includes('--reset');
  if (reset) {
    await Promise.all([User, Group, Membership, JoinRequest, Message, Note, Notification].map((m) => m.deleteMany({})));
    console.log('Database cleared.');
  } else if (await User.exists({ email: DEMO_EMAIL })) {
    console.log('Demo data already present. Use --reset to rebuild it.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const users = {};
  for (const p of people) {
    users[p.key] = await User.create({ name: p.name, email: p.email, mobile: p.mobile, passwordHash, isDemo: true });
  }
  await User.create({ name: 'StudyBot', email: 'studybot@studycircle.invalid', mobile: '+916000000000', passwordHash, isBot: true });

  if (process.env.SEED_SUPERADMIN_EMAIL && process.env.SEED_SUPERADMIN_PASSWORD) {
    await User.create({
      name: 'StudyCircle Admin',
      email: process.env.SEED_SUPERADMIN_EMAIL.toLowerCase(),
      mobile: process.env.SEED_SUPERADMIN_MOBILE || '+916999999999',
      passwordHash: await bcrypt.hash(process.env.SEED_SUPERADMIN_PASSWORD, BCRYPT_COST),
      platformRole: 'superadmin',
    });
  }

  const start = Date.now() - 1000 * 60 * 60 * 6;
  for (const g of groups) {
    const group = await Group.create({
      name: g.name, description: g.description, tags: g.tags, privacy: g.privacy,
      inviteCode: generateInviteCode(), createdBy: users[g.admin]._id, memberCount: g.members.length + 1,
    });
    const joinedAt = new Date(start - 1000 * 60 * 60 * 24 * 30);
    await Membership.create({ group: group._id, user: users[g.admin]._id, role: 'admin', joinedAt, lastReadAt: new Date(start) });
    for (const m of g.members) {
      await Membership.create({ group: group._id, user: users[m]._id, role: 'member', joinedAt, lastReadAt: new Date(start) });
    }

    let t = start;
    for (const [who, text, mentions = []] of chat[g.key] || []) {
      t += 1000 * 60 * 7;
      await Message.create({
        group: group._id, sender: users[who]._id, text,
        mentions: mentions.map((k) => users[k]._id), createdAt: new Date(t), updatedAt: new Date(t),
      });
    }
    for (const [who, title, folder, tags, content] of notes[g.key] || []) {
      await Note.create({ group: group._id, uploadedBy: users[who]._id, title, folder, tags, type: 'markdown', content });
    }
    group.notesCount = (notes[g.key] || []).length;
    await group.save();

    // Pending requests waiting for the demo admin (Ananya) in JEE Physics
    if (g.key === 'jeephy') {
      await JoinRequest.create({ group: group._id, user: users.karan._id, message: 'Same batch at the Ludhiana centre, weak in rotational motion. Would love to join the PYQ sessions.' });
      await JoinRequest.create({ group: group._id, user: users.neha._id });
    }
  }
  console.log(`Seeded ${people.length} users and ${groups.length} groups. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
