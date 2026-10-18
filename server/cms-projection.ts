import catalog from "./full-content-catalog.json";
// Data-only source projections. No eval, Function(), HTML injection or code execution.
const serviceMap = {
  id: "id",
  slug: "slug",
  name: "name",
  shortDescription: "short_description",
  fullDescription: "full_description",
  commonProblems: "common_problems",
  serviceProcess: "service_process",
  coverImage: "cover_image",
  isActive: "is_active",
};
const workMap = {
  id: "legacy_source_id",
  title: "title",
  slug: "slug",
  serviceType: "service_type",
  category: "category",
  description: "description",
  mediaUrl: "media_url",
  mediaType: "media_type",
  isFeatured: "is_featured",
  createdAt: "display_date",
};
const reviewMap = {
  id: "legacy_source_id",
  customerName: "customer_name",
  location: "address",
  review: "review",
  serviceType: "service_type",
  rating: "rating",
  avatarUrl: "avatar_url",
  mediaUrl: "media_url",
  mediaType: "media_type",
  date: "display_date",
  time: "display_time",
  createdAt: "source_created_at",
};
function originalShape(original: any, row: any, map: Record<string, string>) {
  return Object.fromEntries(
    Object.keys(original).map((key) => [key, row[map[key]]]),
  );
}
export function projectStaticRecords(records: Record<string, any[]>) {
  return {
    SERVICES_DATA: catalog.collections.services.map((s) =>
      originalShape(
        s,
        records.services.find((r) => r.id === s.id),
        serviceMap,
      ),
    ),
    WORKS_DATA: catalog.collections.works.map((s) =>
      originalShape(
        s,
        records.works.find((r) => r.legacy_source_id === s.id),
        workMap,
      ),
    ),
    TESTIMONIALS_DATA: catalog.collections.testimonials.map((s) =>
      originalShape(
        s,
        records.testimonials.find((r) => r.legacy_source_id === s.id),
        reviewMap,
      ),
    ),
  };
}
export function renderDocument(document: any) {
  return {
    id: document.id,
    title: document.title,
    groups: document.groups.map((g: any) => ({
      id: g.id,
      label: g.label,
      repeatable: g.repeatable,
      items: g.items.map((i: any) => ({
        id: i.id,
        fields: Object.fromEntries(
          i.fields.map((f: any) => [
            f.id,
            {
              label: f.label,
              kind: f.kind,
              value: f.value,
              ...(f.bindings ? { bindings: f.bindings } : {}),
            },
          ]),
        ),
      })),
    })),
    actions: document.actions,
  };
}
export function renderSiteSource(site: any) {
  const b = site.business_settings;
  const businessMap = {
    name: "business_name",
    shortName: "short_name",
    tagline: "tagline",
    phone: "phone",
    phoneClean: "phone_clean",
    phoneInternational: "phone_international",
    whatsappNumber: "whatsapp",
    location: "address",
    serviceCoverage: "service_coverage",
    businessHours: "hours",
    experience: "experience",
    circuitBoardSpecialty: "circuit_board_specialty",
    aboutSectionImage: "about_image_url",
    facebookUrl: "facebook_url",
    youtubeUrl: "youtube_url",
  };
  return {
    BUSINESS_CONFIG: originalShape(
      catalog.static_values.BUSINESS_CONFIG,
      b,
      businessMap,
    ),
    FAQ_DATA: site.faqs.map((f: any, i: number) => {
      const original = catalog.static_values.FAQ_DATA[i] as any;
      return {
        ...(original && "category" in original ? { category: f.category } : {}),
        question: f.question,
        answer: f.answer,
      };
    }),
    slides: site.hero_slides.map((s: any) => ({
      id: s.source_id,
      badge: s.badge,
      title: s.title,
      titleBn: s.subtitle,
      description: s.description,
      image: s.image_url,
      primaryCta: s.button_label,
      secondaryCta: s.secondary_label,
      ...s.source_flags,
      serviceHint: s.service_hint,
    })),
  };
}

// Additive source-shaped public contracts for frontend-owner integration.
// Explicit field allowlists prevent drafts, consent metadata or submission hashes leaking.
export function renderCollectionRow(
  kind: "services" | "works" | "testimonials",
  row: any,
) {
  if (kind === "services")
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      fullDescription: row.full_description,
      commonProblems: row.common_problems,
      serviceProcess: row.service_process,
      coverImage: row.cover_image,
      isActive: true,
    };
  if (kind === "works")
    return {
      id: row.legacy_source_id || row.id,
      title: row.title,
      slug: row.slug,
      serviceType: row.service_type,
      category: row.category,
      description: row.description,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      isFeatured: row.is_featured,
      createdAt: row.display_date || row.created_at,
    };
  return {
    id: row.legacy_source_id || row.id,
    customerName: row.customer_name,
    location: row.address || undefined,
    review: row.review,
    serviceType: row.service_type,
    rating: row.rating,
    avatarUrl: row.avatar_url || undefined,
    mediaUrl: row.media_url || undefined,
    mediaType: row.media_type || undefined,
    date: row.display_date || undefined,
    time: row.display_time || undefined,
    createdAt: row.source_created_at || row.created_at,
  };
}
