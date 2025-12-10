/**
 * Base error class for media probe errors
 */
export class ProbeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ProbeError';
    Object.setPrototypeOf(this, ProbeError.prototype);
  }
}

/**
 * Error thrown when the URL is invalid or malformed
 */
export class InvalidUrlError extends ProbeError {
  constructor(url: string) {
    super(`Invalid URL: ${url}`, 'INVALID_URL');
    this.name = 'InvalidUrlError';
    Object.setPrototypeOf(this, InvalidUrlError.prototype);
  }
}

/**
 * Error thrown when the network request fails
 */
export class NetworkError extends ProbeError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR', statusCode);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error thrown when the request times out
 */
export class TimeoutError extends ProbeError {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`, 'TIMEOUT');
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Error thrown when all retry attempts are exhausted
 */
export class MaxRetriesExceededError extends ProbeError {
  constructor(attempts: number) {
    super(`Max retries exceeded after ${attempts} attempts`, 'MAX_RETRIES_EXCEEDED');
    this.name = 'MaxRetriesExceededError';
    Object.setPrototypeOf(this, MaxRetriesExceededError.prototype);
  }
}

/**
 * Base error for HTTP client errors (4xx status codes)
 * These errors typically indicate an issue with the request that won't be fixed by retrying
 */
export class ClientError extends NetworkError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = 'ClientError';
    Object.setPrototypeOf(this, ClientError.prototype);
  }
}

/**
 * Error thrown when the media resource is not found (404)
 */
export class NotFoundError extends ClientError {
  constructor(url: string) {
    super(`Media not found: ${url}`, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error thrown when access to the media is forbidden (403)
 */
export class ForbiddenError extends ClientError {
  constructor(url: string) {
    super(`Access forbidden: ${url}`, 403);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Error thrown when authentication is required (401)
 */
export class UnauthorizedError extends ClientError {
  constructor(url: string) {
    super(`Unauthorized access: ${url}`, 401);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Base error for HTTP server errors (5xx status codes)
 * These errors might be temporary and could succeed on retry
 */
export class ServerError extends NetworkError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
