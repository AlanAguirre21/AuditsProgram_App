/**
 * validate({ body, query, params }) — parses each part with its zod schema and replaces it
 * with the parsed (coerced, stripped) value. Express 5 makes req.query a getter, so the parsed
 * query is stored on req.validatedQuery as well.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) {
      const q = schemas.query.parse(req.query);
      req.validatedQuery = q;
      try {
        Object.defineProperty(req, 'query', { value: q, writable: true, configurable: true });
      } catch {
        /* keep validatedQuery only */
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};
