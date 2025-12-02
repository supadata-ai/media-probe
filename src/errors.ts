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
