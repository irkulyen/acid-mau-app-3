/**
 * Base HTTP error class with status code.
 * Throw this from route handlers to send specific HTTP errors.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Convenience constructors
export const BadRequestError = (msg: string) => new HttpError(400, msg);
export const UnauthorizedError = (msg: string) => new HttpError(401, msg);
export const ForbiddenError = (msg: string) => new HttpError(403, msg);
export const NotFoundError = (msg: string) => new HttpError(404, msg);

/**
 * Signals that a gameplay rule has not been explicitly specified by the developer.
 * Use this instead of adding rule fallbacks or inferred behavior.
 */
export class RuleNotSpecifiedError extends Error {
  constructor(ruleName: string, details?: string) {
    super(details ? `Rule not specified: ${ruleName}. ${details}` : `Rule not specified: ${ruleName}`);
    this.name = "RuleNotSpecifiedError";
  }
}

export function assertRuleSpecified<T>(value: T | null | undefined, ruleName: string, details?: string): T {
  if (value === null || value === undefined) {
    throw new RuleNotSpecifiedError(ruleName, details);
  }
  return value;
}
