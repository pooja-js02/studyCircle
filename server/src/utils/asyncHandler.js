// Lets async route handlers throw; Express 4 does not catch rejected promises itself.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
