import { z } from "zod";
import catalog from "./full-content-catalog.json";
import { safeMediaUrl } from "./media";
const scalar = z
  .string()
  .max(16000)
  .refine(
    (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),
    "Control characters are forbidden.",
  );
const identity = z
  .string()
  .min(1)
  .max(250)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
export const cmsLink = (value: string) =>
  value === "" ||
  safeMediaUrl(value) ||
  /^#[a-zA-Z0-9_-]+$/.test(value) ||
  /^tel:\+?[0-9-]{5,25}$/.test(value) ||
  /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const fieldBase = { id: identity, label: scalar, source_key: scalar };
const field = z.discriminatedUnion("kind", [
  z.object({ ...fieldBase, kind: z.literal("text"), value: scalar }).strict(),
  z
    .object({
      ...fieldBase,
      kind: z.literal("template"),
      value: scalar,
      bindings: z.array(scalar).max(30),
    })
    .strict(),
  z
    .object({
      ...fieldBase,
      kind: z.literal("media"),
      value: scalar.refine(
        safeMediaUrl,
        "Use a safe HTTPS or application media URL.",
      ),
    })
    .strict(),
  z
    .object({
      ...fieldBase,
      kind: z.literal("link"),
      value: scalar.refine(cmsLink, "Invalid link."),
    })
    .strict(),
  z
    .object({
      ...fieldBase,
      kind: z.literal("icon"),
      value: z.string().regex(/^[A-Z][A-Za-z0-9]{0,60}$/),
    })
    .strict(),
  z
    .object({
      ...fieldBase,
      kind: z.literal("number"),
      value: z.number().finite().min(-1e9).max(1e9),
    })
    .strict(),
  z
    .object({ ...fieldBase, kind: z.literal("boolean"), value: z.boolean() })
    .strict(),
]);
export const documentSchema = z
  .object({
    id: identity,
    title: scalar,
    source_path: scalar,
    groups: z
      .array(
        z
          .object({
            id: identity,
            label: scalar,
            repeatable: z.boolean(),
            items: z
              .array(
                z
                  .object({ id: identity, fields: z.array(field).max(500) })
                  .strict(),
              )
              .max(200),
          })
          .strict(),
      )
      .max(200),
    actions: z
      .array(
        z
          .object({
            id: identity,
            label: scalar,
            kind: z.enum([
              "booking",
              "navigate",
              "phone",
              "whatsapp",
              "external",
              "interaction",
            ]),
            destination: scalar.refine(cmsLink),
            service_hint: scalar,
            binding: scalar,
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((document, ctx) => {
    const original = catalog.documents.find((d) => d.id === document.id);
    if (!original || document.source_path !== original.source_path) {
      ctx.addIssue({ code: "custom", message: "Unknown source document." });
      return;
    }
    const groups = new Map(original.groups.map((g) => [g.id, g]));
    const used = new Set<string>();
    for (const group of document.groups) {
      const source = groups.get(group.id);
      if (!source || group.repeatable !== source.repeatable) {
        ctx.addIssue({
          code: "custom",
          message: "Unknown group or changed source binding.",
        });
        continue;
      }
      if (
        !source.repeatable &&
        (group.items.length !== source.items.length ||
          group.items.some(
            (i, n) => i.fields.length !== source.items[n]?.fields.length,
          ))
      )
        ctx.addIssue({
          code: "custom",
          message: "Fixed layout copy cannot add/remove structural items.",
        });
      const definitions = new Map<string, any>();
      for (const item of source.items)
        for (const f of item.fields) definitions.set(f.source_key, f);
      if (group.id === "layout_home") {
        const sections = group.items.map(
          (i) => i.fields.find((f) => f.label === "Section")?.value,
        );
        if (
          sections.some(
            (s) =>
              ![
                "hero",
                "services",
                "emergency",
                "about",
                "testimonials",
                "faq",
              ].includes(String(s)),
          ) ||
          new Set(sections).size !== sections.length
        )
          ctx.addIssue({
            code: "custom",
            message: "Choose unique allowlisted home sections.",
          });
      }
      if (new Set(group.items.map((i) => i.id)).size !== group.items.length)
        ctx.addIssue({ code: "custom", message: "Item IDs must be unique." });
      for (const item of group.items) {
        const keys = item.fields.map((f) => f.source_key).sort();
        if (
          !source.items.some(
            (template) =>
              JSON.stringify(
                template.fields.map((f) => f.source_key).sort(),
              ) === JSON.stringify(keys),
          )
        )
          ctx.addIssue({
            code: "custom",
            message:
              "Every item must preserve a complete source field template.",
          });
        for (const f of item.fields) {
          if (used.has(f.id))
            ctx.addIssue({ code: "custom", message: "Duplicate field ID." });
          used.add(f.id);
          const def = definitions.get(f.source_key);
          if (
            !def ||
            f.kind !== def.kind ||
            f.label !== def.label ||
            (!source.repeatable && f.id !== def.id)
          )
            ctx.addIssue({
              code: "custom",
              message: "Field type and binding are immutable.",
            });
          if (
            f.label === "target" &&
            !["_blank", "_self", "_parent", "_top"].includes(String(f.value))
          )
            ctx.addIssue({
              code: "custom",
              message: "Use a standard browser target.",
            });
          if (
            f.label === "rel" &&
            ["noopener", "noreferrer"].some(
              (token) =>
                String(def?.value).includes(token) &&
                !String(f.value).split(/\s+/).includes(token),
            )
          )
            ctx.addIssue({
              code: "custom",
              message: "Preserve link security attributes.",
            });
          if (
            f.label === "language" &&
            !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/.test(String(f.value))
          )
            ctx.addIssue({
              code: "custom",
              message: "Use a valid language tag.",
            });
          if (f.kind === "template") {
            if (
              (["href", "src", "poster"].includes(f.label) ||
                /^(https?:|tel:|\/)/.test(String(def?.value))) &&
              !cmsLink(f.value.replace(/\{\{binding\d+\}\}/g, "01619487788"))
            )
              ctx.addIssue({ code: "custom", message: "Unsafe URL template." });
            if (
              JSON.stringify(f.bindings) !==
                JSON.stringify((def as any)?.bindings) ||
              JSON.stringify(f.value.match(/\{\{binding\d+\}\}/g) ?? []) !==
                JSON.stringify(
                  String(def?.value ?? "").match(/\{\{binding\d+\}\}/g) ?? [],
                )
            )
              ctx.addIssue({
                code: "custom",
                message:
                  "Keep original template binding placeholders and order.",
              });
          }
          if (
            f.kind === "icon" &&
            !catalog.documents.some((d) =>
              d.groups.some((g) =>
                g.items.some((i) =>
                  i.fields.some(
                    (x) => x.kind === "icon" && x.value === f.value,
                  ),
                ),
              ),
            )
          )
            ctx.addIssue({
              code: "custom",
              message: "Choose an existing allowlisted icon.",
            });
        }
      }
    }
    if (
      document.groups.length !== original.groups.length ||
      new Set(document.groups.map((g) => g.id)).size !== original.groups.length
    )
      ctx.addIssue({
        code: "custom",
        message: "All source groups must remain present.",
      });
    const ids = new Set<string>();
    for (const action of document.actions) {
      const def = original.actions.find((a) => a.id === action.id);
      if (
        ids.has(action.id) ||
        !def ||
        def.binding !== action.binding ||
        (def.kind === "interaction" && action.kind !== "interaction")
      )
        ctx.addIssue({
          code: "custom",
          message: "Action identity and executable binding cannot change.",
        });
      ids.add(action.id);
      if (action.kind === "navigate" && def?.destination && !action.destination)
        ctx.addIssue({
          code: "custom",
          message: "Navigation needs a destination.",
        });
    }
    if (document.actions.length !== original.actions.length)
      ctx.addIssue({
        code: "custom",
        message: "Preserve every source action binding.",
      });
  });
export type CmsDocument = z.infer<typeof documentSchema>;
export const documentDefinitions = catalog.documents.map((d) => ({
  id: d.id,
  title: d.title,
  source_path: d.source_path,
  groups: d.groups.map((g) => ({
    id: g.id,
    label: g.label,
    repeatable: g.repeatable,
    template: g.items[0] ?? null,
  })),
  field_count: d.groups.reduce(
    (n, g) => n + g.items.reduce((m, i) => m + i.fields.length, 0),
    0,
  ),
  action_count: d.actions.length,
}));
