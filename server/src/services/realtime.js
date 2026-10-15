// Holds the Socket.io server so REST controllers can push live events.
let io = null;

export const setIo = (server) => {
  io = server;
};

export const userRoom = (userId) => `user:${userId}`;
export const groupRoom = (groupId) => `group:${groupId}`;

export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToGroup(groupId, event, payload) {
  io?.to(groupRoom(groupId)).emit(event, payload);
}

// Every open tab of the user starts (or stops) receiving the group's events at once.
export function joinUserToGroup(userId, groupId) {
  io?.in(userRoom(userId)).socketsJoin(groupRoom(groupId));
}

export function removeUserFromGroup(userId, groupId) {
  io?.in(userRoom(userId)).socketsLeave(groupRoom(groupId));
}

export function closeGroupRoom(groupId) {
  io?.in(groupRoom(groupId)).socketsLeave(groupRoom(groupId));
}
