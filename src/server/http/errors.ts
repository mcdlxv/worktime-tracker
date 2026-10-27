export type HttpErrorCode = "CROSS_SITE_REQUEST" | "UNSUPPORTED_MEDIA_TYPE";

/** A problem with the HTTP request itself rather than with the domain: it carries its status. */
export class HttpError extends Error {
  constructor(
    readonly status: 403 | 415,
    readonly code: HttpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
