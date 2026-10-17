import { z } from "zod";
import { ApiError } from "./errors";
export const revisionSchema = z.number().int().min(0).max(2147483646);
export const text = z
  .string()
  .trim()
  .max(8000)
  .refine(
    (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),
    "Control characters are not supported.",
  );
export function revision(value: unknown) {
  const parsed = revisionSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      400,
      "REVISION_REQUIRED",
      "Reload and provide the current revision.",
    );
  return parsed.data;
}
export function conflict() {
  return new ApiError(
    409,
    "REVISION_CONFLICT",
    "Content changed in another session. Reload before retrying.",
  );
}
export function route(
  handler: import("express").RequestHandler,
): import("express").RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch((error) =>
        next(
          error instanceof ApiError
            ? error
            : new ApiError(
                503,
                "ADMIN_UNAVAILABLE",
                "The operation was not confirmed. Please reload and retry.",
              ),
        ),
      );
  };
}
export { transaction } from "./db/transaction";
export function parse<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(
      400,
      "INVALID_ADMIN_INPUT",
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
export const listQuery = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.string().max(30).default("all"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export function searchPattern(value: string) {
  return "%" + value.replace(/[\\%_]/g, "\\$&") + "%";
}
