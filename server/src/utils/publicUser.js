// FR-PRIV-03: other users are only ever exposed as _id, name and avatar.
export function publicUser(user) {
  if (!user) return null;
  return { _id: String(user._id), name: user.name, avatar: user.avatarUrl || null };
}

// The signed-in user's own view of themselves (FR-AUTH-08, FR-PRIV-01).
export function selfUser(user) {
  return {
    _id: String(user._id),
    name: user.name,
    avatar: user.avatarUrl || null,
    email: user.email,
    mobile: user.mobile,
    platformRole: user.platformRole,
    isDemo: Boolean(user.isDemo),
  };
}

export const PUBLIC_USER_FIELDS = 'name avatarUrl';
