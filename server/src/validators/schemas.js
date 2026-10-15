import mongoose from 'mongoose';
import { z } from 'zod';
import { PRIVACY } from '../models/Group.js';
import { MAX_MESSAGE_LENGTH } from '../models/Message.js';

// FR-AUTH-02: 10 digits starting 6-9; accepts "+91 98765 43210", "098765 43210" etc.
export function normalizeMobile(raw) {
  let digits = String(raw ?? '').replace(/[\s()-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

const name = z.string().trim().min(2, 'Name must be at least 2 characters.').max(60, 'Name must be 60 characters or fewer.');
const mobile = z
  .string({ required_error: 'Mobile number is required.' })
  .transform((v, ctx) => {
    const normalized = normalizeMobile(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.' });
      return z.NEVER;
    }
    return normalized;
  });
const password = z
  .string({ required_error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.');
const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id.');

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(8, 'Use at most 8 tags.')
  .default([])
  .transform((list) => [...new Set(list)]);

export const registerSchema = z.object({
  name,
  email: z
    .string({ required_error: 'Gmail address is required.' })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.+_-]+@gmail\.com$/, 'Use a Gmail address (name@gmail.com).'),
  mobile,
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

// FR-AUTH-08: changing the mobile number needs the current password.
export const updateMeSchema = z
  .object({
    name: name.optional(),
    mobile: mobile.optional(),
    currentPassword: z.string().optional(),
    removeAvatar: z.boolean().optional(),
  })
  .refine((v) => !v.mobile || v.currentPassword, {
    message: 'Enter your current password to change your mobile number.',
    path: ['currentPassword'],
  });

export const createGroupSchema = z.object({
  name: z.string().trim().min(3, 'Group name must be at least 3 characters.').max(80),
  description: z.string().trim().max(500).default(''),
  tags,
  privacy: z.enum(PRIVACY).default('approval'),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    tags: tags.optional(),
    privacy: z.enum(PRIVACY).optional(),
    settings: z
      .object({
        studyBotEnabled: z.boolean().optional(),
        chatLockDuringFocus: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const deleteGroupSchema = z.object({ confirmName: z.string().min(1, 'Type the group name to confirm.') });

export const searchGroupsSchema = z.object({
  search: z.string().trim().max(80).optional().default(''),
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [])),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

export const joinRequestSchema = z.object({
  message: z.string().trim().max(300, 'Keep your message under 300 characters.').default(''),
});

export const reviewRequestSchema = z.object({ action: z.enum(['approve', 'reject']) });

export const transferAdminSchema = z.object({ userId: objectId });

export const messagesQuerySchema = z.object({
  before: objectId.optional(),
  around: objectId.optional(),
});

export const sendMessageSchema = z.object({
  groupId: objectId,
  text: z.string().trim().min(1, 'Message is empty.').max(MAX_MESSAGE_LENGTH, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`),
  mentions: z.array(objectId).max(50).default([]),
  clientId: z.string().max(64).optional(),
});

const noteFields = {
  title: z.string().trim().min(1, 'Give the note a title.').max(120),
  folder: z.string().trim().max(60).default('General').transform((v) => v || 'General'),
};

// Multipart bodies send tags as a comma-separated string.
const tagsField = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : (v || '').split(',')).map((t) => t.trim()).filter(Boolean))
  .pipe(tags);

export const createNoteSchema = z.object({
  ...noteFields,
  tags: tagsField,
  content: z.string().max(50000).optional(),
});

export const updateNoteSchema = z
  .object({
    title: noteFields.title.optional(),
    folder: noteFields.folder.optional(),
    tags: tagsField.optional(),
    content: z.string().max(50000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const notesQuerySchema = z.object({
  search: z.string().trim().max(80).optional().default(''),
  folder: z.string().trim().max(60).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
});

export const markReadSchema = z.object({ ids: z.array(objectId).max(100).optional() });
