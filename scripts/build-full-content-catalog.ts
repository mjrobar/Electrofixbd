import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource, extractVariables, sha } from "./lib/static-inventory";
const runGit = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export async function buildFullCatalog(
  sourceRef = "d8610dcdd87c6fcf6034ec08ca8122fce780627c",
) {
  if (!/^[a-f0-9]{40}$/.test(sourceRef))
    throw Error("Use a reviewed immutable Git commit, not a moving branch.");
  const verifyPinned = async (path: string, text: string) => {
    const original = (
      await runGit("git", ["show", sourceRef + ":" + path], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      })
    ).stdout.replace(/\r\n/g, "\n");
    if (sha(original) !== sha(text.replace(/\r\n/g, "\n")))
      throw Error(
        path +
          " differs from pinned source " +
          sourceRef +
          ". Review field mappings; never refresh hashes alone.",
      );
  };
  const files: string[] = [];
  async function crawl(path: string) {
    for (const entry of await readdir(resolve(root, path), {
      withFileTypes: true,
    })) {
      const target = path + "/" + entry.name;
      if (entry.isDirectory()) await crawl(target);
      else if (/\.tsx?$/.test(target)) files.push(target);
    }
  }
  await crawl("src/components");
  await crawl("src/data");
  files.push(
    "src/App.tsx",
    "src/lib/bookingClient.ts",
    "src/types.ts",
    "src/main.tsx",
  );
  files.sort();
  const primary: Record<string, string[]> = {
    "src/data/servicesData.ts": ["SERVICES_DATA"],
    "src/data/worksData.ts": ["WORKS_DATA"],
    "src/data/testimonialsData.ts": ["TESTIMONIALS_DATA", "FAQ_DATA"],
    "src/data/siteConfig.ts": ["BUSINESS_CONFIG"],
    "src/components/home/HeroSlider.tsx": ["slides"],
  };
  const variables: Record<string, any> = {},
    sources: any[] = [],
    documents: any[] = [],
    inventory: any[] = [];
  for (const path of files) {
    const text = (await readFile(resolve(root, path), "utf8")).replace(
      /\r\n/g,
      "\n",
    );
    if (/backgroundImage\s*:/.test(text))
      throw Error(
        "Inline CSS media requires an explicit mapping before import: " + path,
      );
    await verifyPinned(path, text);
    const scan = scanSource(text, path, primary[path] ?? []);
    Object.assign(variables, extractVariables(text, path));
    sources.push({ path, sha256: scan.sha256 });
    documents.push(scan.document);
    inventory.push(
      ...scan.inventory.map((entry) => ({ source_path: path, ...entry })),
    );
  }
  const app = documents.find((d) => d.source_path === "src/App.tsx");
  const layout = {
    id: "layout_home",
    label: "Home section order",
    repeatable: true,
    items: [
      "hero",
      "services",
      "emergency",
      "about",
      "testimonials",
      "faq",
    ].map((section, i) => ({
      id: "layout_" + section,
      fields: [
        {
          id: "layout_" + section + "_name",
          label: "Section",
          kind: "text",
          value: section,
          source_key: "composition.home[" + i + "].section",
        },
        {
          id: "layout_" + section + "_enabled",
          label: "Enabled",
          kind: "boolean",
          value: true,
          source_key: "composition.home[" + i + "].enabled",
        },
      ],
    })),
  };
  app.groups.push(layout);
  for (const item of layout.items)
    for (const f of item.fields)
      inventory.push({
        id: f.id,
        source_path: app.source_path,
        source_key: f.source_key,
        line: 0,
        column: 0,
        value: f.value,
        classification: "composition",
        reason:
          "Safe section-order projection of original home JSX; component implementations remain immutable",
        target: {
          document: app.id,
          group: layout.id,
          item: item.id,
          field: f.id,
        },
      });
  const html = await readFile(resolve(root, "index.html"), "utf8");
  await verifyPinned("index.html", html);
  const htmlFields: any[] = [];
  const addHtml = (key: string, value: string) => {
    const id = "html_" + key.replace(/[^a-z0-9_]/gi, "_");
    const field = {
      id,
      label: key,
      kind: "text",
      value,
      source_key: "html." + key,
    };
    htmlFields.push(field);
    inventory.push({
      id,
      source_path: "index.html",
      source_key: field.source_key,
      value,
      line: html.slice(0, html.indexOf(value)).split("\n").length,
      column: 0,
      classification: "editorial",
      reason: null,
      target: {
        document: "ui_metadata",
        group: "metadata",
        item: "metadata",
        field: id,
      },
    });
  };
  addHtml("language", html.match(/<html lang="([^"]+)"/)![1]);
  addHtml("title", html.match(/<title>([^<]+)<\/title>/)![1]);
  for (const match of html.matchAll(
    /<meta (?:name|property)="([^"]+)" content="([^"]*)"/g,
  )) {
    if (match[1] === "viewport") continue;
    addHtml(match[1], match[2]);
  }
  documents.push({
    id: "ui_metadata",
    title: "Page metadata and social sharing",
    source_path: "index.html",
    groups: [
      {
        id: "metadata",
        label: "Page metadata",
        repeatable: false,
        items: [{ id: "metadata", fields: htmlFields }],
      },
    ],
    actions: [],
  });
  sources.push({
    path: "index.html",
    sha256: sha(html.replace(/\r\n/g, "\n")),
  });
  const css = await readFile(resolve(root, "src/index.css"), "utf8");
  if (/url\s*\(|content\s*:/.test(css))
    throw Error(
      "CSS-generated copy/media requires an explicit mapping before import.",
    );
  await verifyPinned("src/index.css", css);
  sources.push({
    path: "src/index.css",
    sha256: sha(css.replace(/\r\n/g, "\n")),
  });
  inventory.push({
    id: "public_css",
    source_path: "src/index.css",
    source_key: "stylesheet",
    line: 1,
    column: 0,
    classification: "behavior",
    reason:
      "Approved immutable CSS, animations and font system; no authored generated-content strings or media URLs",
    target: null,
  });
  const services = variables.SERVICES_DATA,
    works = variables.WORKS_DATA,
    testimonials = variables.TESTIMONIALS_DATA;
  const legacy = JSON.parse(
    await readFile(
      resolve(root, "server/existing-content-catalog.json"),
      "utf8",
    ),
  );
  const hero = variables.slides.map((s: any, index: number) => ({
    id: "legacy-hero-" + (index + 1),
    source_id: s.id,
    title: s.title,
    subtitle: s.titleBn,
    description: s.description,
    image_url: s.image,
    button_label: s.primaryCta,
    button_url: "",
    badge: s.badge,
    actions_configured: true,
    primary_action: "booking",
    service_hint: s.serviceHint ?? "",
    secondary_label: s.secondaryCta,
    secondary_action: s.isPhoneCall
      ? "phone"
      : s.isWhatsApp
        ? "whatsapp"
        : s.isNavigateServices
          ? "navigate"
          : "none",
    secondary_url: s.isNavigateServices ? "/services" : "",
    source_flags: Object.fromEntries(
      ["isPhoneCall", "isWhatsApp", "isNavigateServices"]
        .filter((k) => k in s)
        .map((k) => [k, s[k]]),
    ),
    is_active: true,
  }));
  const business = {
    ...legacy.data.business_settings,
    email: "",
    logo_url: "",
  };
  const faqs = variables.FAQ_DATA.map((f: any, i: number) => ({
    id: "legacy-faq-" + (i + 1),
    question: f.question,
    answer: f.answer,
    category: f.category ?? "General",
    is_active: true,
  }));
  const result = {
    format: "electrofix-full-static-v2",
    mapping_version: 2,
    source_ref: sourceRef,
    original_ai_studio_reconciled: false,
    sources,
    inventory,
    documents: documents.filter((d) => d.groups.length || d.actions.length),
    static_values: Object.fromEntries(
      Object.values(primary)
        .flat()
        .map((name) => [name, variables[name]]),
    ),
    collections: { services, works, testimonials },
    site_content: {
      hero_slides: hero,
      faqs,
      business_settings: business,
      page_sections: legacy.data.page_sections,
    },
    notes: [
      "Pinned repository source is fully enumerated; original independent AI Studio workspace reconciliation remains a rollout gate.",
      "Structural CSS/layout and executable behavior stay in frontend code. Every literal has an explicit editable target or exclusion; callbacks are declarative bindings, never fabricated URLs.",
      "Legacy page_sections are retained as a compatibility projection; full component documents are canonical for detailed component copy and repeated groups.",
      "No customer records are a static import source. Missing email/logo/street address are not invented. Business address contains the authored city only.",
    ],
  };
  return { ...result, snapshot_digest: sha(JSON.stringify(result)) };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argument = process.argv.find((v) => v.startsWith("--source-ref="));
  const catalog = await buildFullCatalog(
    argument?.slice("--source-ref=".length),
  );
  const json = JSON.stringify(catalog, null, 2) + "\n";
  const path = resolve(root, "server/full-content-catalog.json");
  if (process.argv.includes("--check")) {
    if ((await readFile(path, "utf8")) !== json)
      throw Error(
        "Full snapshot or source mapping changed; review every field before regenerating.",
      );
    console.log("Full static snapshot and inventory match pinned source.");
  } else {
    await writeFile(path, json);
    console.log(
      JSON.stringify({
        documents: catalog.documents.length,
        fields: catalog.inventory.filter((i) => i.target).length,
        excluded: catalog.inventory.filter((i) => !i.target).length,
        collections: Object.fromEntries(
          Object.entries(catalog.collections).map(([k, v]) => [k, v.length]),
        ),
      }),
    );
  }
}
