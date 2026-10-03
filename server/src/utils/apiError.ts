/**
 * Throw from a route/service to send `{ error: code, ...body }` with `status`.
 * With `rawBody: true` the body is sent exactly as given (for responses whose shape the
 * client already depends on). Inside withTransaction() this also rolls back everything
 * written so far.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body?: Record<string, unknown>,
    public readonly rawBody = false
  ) {
    super(code);
    this.name = "ApiError";
  }
}
