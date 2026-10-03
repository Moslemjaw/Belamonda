/**
 * Throw from a route/service to send `{ error: code }` with `status`.
 * Inside withTransaction() this also rolls back everything written so far.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body?: Record<string, unknown>
  ) {
    super(code);
    this.name = "ApiError";
  }
}
