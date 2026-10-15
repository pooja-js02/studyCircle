import { badRequest } from '../utils/AppError.js';

// NFR-SEC-05: every input is validated on the server with a zod schema.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      return next(badRequest(issue.message, { field, issues: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }));
    }
    req[source === 'query' ? 'validQuery' : source] = result.data;
    next();
  };
}
