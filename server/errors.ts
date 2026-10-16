import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Please try again later. The request could not be completed.";
  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Please provide valid booking or contact details.";
  } else if (err?.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Please use a smaller request.";
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Please provide a valid JSON request.";
  } else if (err instanceof URIError) {
    status = 400;
    code = "INVALID_PATH";
    message = "Please provide a valid request path.";
  } else if (err?.status === 415) {
    status = 415;
    code = "UNSUPPORTED_MEDIA_TYPE";
    message = "Please send UTF-8 application/json.";
  }
  // Do not return raw driver errors, credentials, stack traces or customer details.
  res
    .status(status)
    .json({ error: message, code, request_id: res.locals.requestId });
};
