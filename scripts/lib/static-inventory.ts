// Read-only AST audit. Never evaluates frontend modules, callbacks, or source code.
import { parse } from "@babel/parser";
import { createHash } from "node:crypto";
export const sha = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Field = {
  id: string;
  label: string;
  kind: "text" | "media" | "link" | "template" | "number" | "boolean" | "icon";
  value: string | number | boolean;
  source_key: string;
  bindings?: string[];
};
export type Document = {
  id: string;
  title: string;
  source_path: string;
  groups: {
    id: string;
    label: string;
    repeatable: boolean;
    items: { id: string; fields: Field[] }[];
  }[];
  actions: {
    id: string;
    label: string;
    kind:
      | "booking"
      | "navigate"
      | "phone"
      | "whatsapp"
      | "external"
      | "interaction";
    destination: string;
    service_hint: string;
    binding: string;
  }[];
};
type Frame = { node: any; key: string };
export function parseSource(source: string, path: string) {
  return parse(source, {
    sourceType: "module",
    plugins: path.endsWith("tsx") ? ["typescript", "jsx"] : ["typescript"],
  });
}
export function staticValue(node: any): any {
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type))
    return node.value;
  if (node.type === "NullLiteral") return null;
  if (node.type === "ArrayExpression") return node.elements.map(staticValue);
  if (node.type === "ObjectExpression")
    return Object.fromEntries(
      node.properties.map((p: any) => {
        if (p.type !== "ObjectProperty" || p.computed)
          throw Error("Nonstatic object");
        return [p.key.name ?? p.key.value, staticValue(p.value)];
      }),
    );
  if (["TSAsExpression", "TSSatisfiesExpression"].includes(node.type))
    return staticValue(node.expression);
  throw Error("Nonstatic data: " + node.type);
}
export function extractVariables(source: string, path: string) {
  const variables: Record<string, unknown> = {};
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init
    ) {
      try {
        variables[node.id.name] = staticValue(node.init);
      } catch {}
    }
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "extra", "comments", "tokens"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(parseSource(source, path));
  return variables;
}
export function scanSource(
  source: string,
  path: string,
  coreVariables: string[] = [],
) {
  source = source.replace(/\r\n/g, "\n");
  const ast = parseSource(source, path),
    doc: Document = {
      id:
        "ui_" +
        path
          .replace(/^src\//, "")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .toLowerCase(),
      title: path
        .split("/")
        .pop()!
        .replace(/\.tsx?$/, ""),
      source_path: path,
      groups: [],
      actions: [],
    };
  const inventory: any[] = [];
  function walk(node: any, frames: Frame[] = []) {
    if (!node || typeof node !== "object" || !node.type) return;
    const chain = [...frames, { node, key: "" }];
    const attr = [...frames]
      .reverse()
      .find((f) => f.node.type === "JSXAttribute")?.node;
    const attrName = attr?.name?.name;
    const variable = [...frames]
      .reverse()
      .find(
        (f) =>
          f.node.type === "VariableDeclarator" &&
          f.node.id.type === "Identifier",
      )?.node;
    const variableName = variable?.id.name;
    const ancestor = (type: string) => frames.some((f) => f.node.type === type);
    const location = {
      line: node.loc?.start.line,
      column: node.loc?.start.column,
    };
    const key = frames.map((f) => f.key).join(".") + ":" + node.type;
    const id = "f_" + sha(path + ":" + key).slice(0, 16);
    let value: unknown,
      kind: Field["kind"] = "text",
      candidate = false;
    if (
      node.type === "Identifier" &&
      frames.at(-1)?.node.type === "ObjectProperty" &&
      frames.at(-1)?.node.key?.name === "icon" &&
      frames.at(-1)?.node.value === node
    ) {
      value = node.name;
      kind = "icon";
      candidate = true;
    }
    if (
      ["StringLiteral", "NumericLiteral", "BooleanLiteral", "JSXText"].includes(
        node.type,
      )
    ) {
      value = node.type === "JSXText" ? node.value : node.value;
      candidate = true;
      kind =
        typeof value === "number"
          ? "number"
          : typeof value === "boolean"
            ? "boolean"
            : "text";
    }
    if (node.type === "TemplateLiteral") {
      value = node.quasis
        .map(
          (q: any, i: number) =>
            q.value.cooked +
            (i < node.expressions.length ? "{{binding" + i + "}}" : ""),
        )
        .join("");
      kind = "template";
      candidate = true;
    }
    if (candidate) {
      let reason = "";
      const parent = frames.at(-1)?.node;
      if (frames.some((f) => f.node.type.startsWith("TS")))
        reason = "Type contract, not rendered content";
      else if (
        ancestor("ImportDeclaration") ||
        (ancestor("ExportNamedDeclaration") &&
          parent?.type === "ExportSpecifier")
      )
        reason = "Module binding";
      else if (node.type === "JSXText" && !String(value).trim())
        reason = "JSX formatting whitespace";
      else if (ancestor("TemplateLiteral") || ancestor("TemplateElement"))
        reason = "Included in the complete template field";
      else if (
        attrName &&
        [
          "className",
          "style",
          "id",
          "key",
          "type",
          "name",
          "htmlFor",
          "autoComplete",
          "inputMode",
          "accept",
          "method",
          "role",
          "aria-live",
          "aria-expanded",
          "aria-hidden",
          "tabIndex",
        ].includes(attrName)
      )
        reason =
          "Immutable design, accessibility/state or form protocol; labels remain editorial";
      else if (
        attr &&
        typeof attrName === "string" &&
        /^on[A-Z]/.test(attrName)
      )
        reason =
          "Action binding; captured separately without executable CMS code";
      else if (parent?.type === "ObjectProperty" && parent.key === node)
        reason = "Object field identity";
      else if (
        frames.some(
          (f) =>
            f.node.type === "CallExpression" &&
            [
              "fetch",
              "getItem",
              "setItem",
              "removeItem",
              "addEventListener",
              "removeEventListener",
              "querySelector",
              "getElementById",
              "test",
              "match",
              "replace",
              "split",
              "join",
              "includes",
              "startsWith",
              "endsWith",
              "toLocaleString",
              "toLocaleDateString",
              "toLocaleTimeString",
            ].includes(f.node.callee?.name ?? f.node.callee?.property?.name),
        )
      )
        reason = "Runtime protocol, formatting, lookup or algorithm";
      else if (
        frames.some(
          (f) =>
            f.node.type === "CallExpression" &&
            f.node.callee?.object?.name === "console",
        )
      )
        reason = "Diagnostic logging";
      else if (
        parent &&
        [
          "BinaryExpression",
          "SwitchCase",
          "UnaryExpression",
          "RegExpLiteral",
        ].includes(parent.type)
      )
        reason = "Runtime discriminant/algorithm";
      else if (
        frames.some(
          (f) =>
            f.node.type === "CallExpression" &&
            [
              "useState",
              "setInterval",
              "setTimeout",
              "clearInterval",
              "clearTimeout",
            ].includes(f.node.callee?.name),
        )
      )
        reason = "Runtime state/timing; not authored editorial data";
      else if (
        (typeof value === "number" || typeof value === "boolean") &&
        !ancestor("ObjectExpression") &&
        !ancestor("ArrayExpression") &&
        !attr
      )
        reason = "Runtime algorithm constant";
      else if (typeof value === "string" && value === "")
        reason =
          "Empty runtime initial value; explicit missing business values are separately modeled";
      const core = coreVariables.includes(variableName);
      let target: unknown = null;
      if (core && !reason) {
        const start = frames.findIndex((f) => f.node === variable);
        const parts = frames
          .slice(start + 1)
          .flatMap((f) =>
            f.node.type === "ObjectProperty" && f.key === "value"
              ? [f.node.key.name ?? f.node.key.value]
              : f.node.type === "ArrayExpression" &&
                  /^elements\[\d+\]$/.test(f.key)
                ? [Number(f.key.match(/\d+/)![0])]
                : [],
          );
        target = { collection: variableName, path: parts };
      }
      if (!reason && !core) {
        if (typeof value === "string" && /^https:\/\//.test(value))
          kind = /image|photo|media|cover|poster|avatar|src/i.test(
            (parent?.key?.name ?? attrName ?? "") + value,
          )
            ? "media"
            : "link";
        else if (
          typeof value === "string" &&
          value.startsWith("/") &&
          !value.startsWith("//")
        )
          kind = "link";
        if (["src", "poster"].includes(attrName)) kind = "media";
        else if (attrName === "href" && kind !== "template") kind = "link";
        const arrayFrames = frames.filter(
          (f) => f.node.type === "ArrayExpression",
        );
        const array = arrayFrames.at(-1)?.node;
        const index = array
          ? array.elements.findIndex(
              (n: any) => n && n.start <= node.start && n.end >= node.end,
            )
          : -1;
        const groupLabel =
          array && variableName
            ? variableName
            : variableName && ancestor("ObjectExpression")
              ? variableName
              : "Visible copy and labels";
        const gid =
          "g_" +
          sha(path + ":" + groupLabel + (array ? ":" + array.start : "")).slice(
            0,
            12,
          );
        let group = doc.groups.find((g) => g.id === gid);
        if (!group) {
          group = {
            id: gid,
            label: groupLabel,
            repeatable: Boolean(array && variableName),
            items: [],
          };
          doc.groups.push(group);
        }
        const itemId = gid + "_" + (index >= 0 ? index : 0);
        let item = group.items.find((i) => i.id === itemId);
        if (!item) {
          item = { id: itemId, fields: [] };
          group.items.push(item);
        }
        const label =
          parent?.type === "ObjectProperty"
            ? String(parent.key.name ?? parent.key.value)
            : attrName ||
              ([...frames].reverse().find((f) => f.node.type === "JSXElement")
                ?.node.openingElement.name.name ?? "Text") +
                " · line " +
                location.line;
        const field: Field = {
          id,
          label,
          kind,
          value: value as Field["value"],
          source_key: key,
          ...(kind === "template"
            ? {
                bindings: node.expressions.map((e: any) =>
                  source.slice(e.start, e.end),
                ),
              }
            : {}),
        };
        item.fields.push(field);
        target = { document: doc.id, group: gid, item: itemId, field: id };
      }
      inventory.push({
        id,
        source_key: key,
        ...location,
        value,
        classification: reason ? "behavior" : core ? "collection" : "editorial",
        reason: reason || null,
        target,
      });
    }
    if (
      node.type === "JSXExpressionContainer" &&
      ![
        "JSXEmptyExpression",
        "StringLiteral",
        "NumericLiteral",
        "BooleanLiteral",
        "TemplateLiteral",
      ].includes(node.expression?.type)
    ) {
      inventory.push({
        id: "b_" + sha(path + ":" + key).slice(0, 16),
        source_key: key,
        ...location,
        classification: "binding",
        reason:
          "Dynamic data/composition/behavior binding: resolve through allowlisted original frontend code, never execute CMS strings",
        binding: source.slice(node.expression.start, node.expression.end),
        target: null,
      });
    }
    if (
      node.type === "JSXAttribute" &&
      ["onClick", "href"].includes(node.name?.name) &&
      node.value?.type === "JSXExpressionContainer"
    ) {
      const binding = source.slice(
        node.value.expression.start,
        node.value.expression.end,
      );
      const kind = /[Oo]penBooking/.test(binding)
        ? "booking"
        : /getPhoneCallUrl/.test(binding)
          ? "phone"
          : /getWhatsAppUrl/.test(binding)
            ? "whatsapp"
            : /onNavigate|navigate\(|handleLinkClick/.test(binding)
              ? "navigate"
              : "interaction";
      let literal = "";
      const findArgument = (n: any) => {
        if (!n || typeof n !== "object") return;
        if (
          n.type === "CallExpression" &&
          /onNavigate|navigate|handleLinkClick|onOpenBooking|handleOpenBooking/.test(
            n.callee?.name ?? "",
          ) &&
          n.arguments[0]?.type === "StringLiteral" &&
          !literal
        )
          literal = n.arguments[0].value;
        for (const [k, v] of Object.entries(n)) {
          if (["loc", "extra", "comments"].includes(k)) continue;
          if (Array.isArray(v)) v.forEach(findArgument);
          else if (v && typeof v === "object") findArgument(v);
        }
      };
      findArgument(node.value.expression);
      const element = [...frames]
        .reverse()
        .find((f) => f.node.type === "JSXElement")?.node;
      const texts: string[] = [];
      const visible = (n: any) => {
        if (!n || typeof n !== "object") return;
        if (n.type === "JSXText" && n.value.trim()) texts.push(n.value.trim());
        if (n.type === "JSXElement") n.children.forEach(visible);
        if (
          n.type === "JSXExpressionContainer" &&
          n.expression?.type === "StringLiteral"
        )
          texts.push(n.expression.value);
      };
      if (element) visible(element);
      const aria = element?.openingElement.attributes.find(
        (a: any) =>
          a.type === "JSXAttribute" &&
          a.name?.name === "aria-label" &&
          a.value?.type === "StringLiteral",
      )?.value.value;
      doc.actions.push({
        id: "a_" + sha(path + ":" + key).slice(0, 16),
        label: String(aria || texts.join(" ") || kind + " action").slice(
          0,
          250,
        ),
        kind,
        destination: kind === "navigate" ? literal : "",
        service_hint: kind === "booking" ? literal : "",
        binding,
      });
    }
    for (const [prop, child] of Object.entries(node)) {
      if (
        [
          "loc",
          "extra",
          "comments",
          "tokens",
          "leadingComments",
          "trailingComments",
          "innerComments",
        ].includes(prop)
      )
        continue;
      if (Array.isArray(child))
        child.forEach((value, i) =>
          walk(value, [...frames, { node, key: prop + "[" + i + "]" }]),
        );
      else if (child && typeof child === "object")
        walk(child, [...frames, { node, key: prop }]);
    }
  }
  walk(ast);
  return {
    document: doc,
    inventory,
    sha256: sha(source.replace(/\r\n/g, "\n")),
  };
}
