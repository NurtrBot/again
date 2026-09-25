/* Framework-free error types shared by API routes, services and the worker. */
export class HttpError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
  headers?: Record<string, string>;
  constructor(status: number, code: string, message: string, opts: { retryable?: boolean; fieldErrors?: Record<string, string>; headers?: Record<string, string> } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = opts.retryable ?? status >= 500;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.headers = opts.headers;
  }
}
export const notFound = (what = 'resource') => new HttpError(404, 'not_found', `We can’t find that ${what}.`);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Sign in to continue.');
