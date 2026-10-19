import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { SERVICES_DATA, getServiceBySlug } from "../src/data/servicesData";
import { WORKS_DATA } from "../src/data/worksData";
import { TESTIMONIALS_DATA } from "../src/data/testimonialsData";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const works = readFileSync(
  new URL("../src/components/works/WorkGallery.tsx", import.meta.url),
  "utf8",
);
const testimonials = readFileSync(
  new URL("../src/components/home/TestimonialsSection.tsx", import.meta.url),
  "utf8",
);

test("services baseline remains available at initial render", () => {
  assert.ok(SERVICES_DATA.length >= 6);
  assert.match(app, /useState<Service\[\]>\(SERVICES_DATA\)/);
});
test("service direct URLs have static slug fallback", () => {
  assert.equal(getServiceBySlug("ac-repair")?.slug, "ac-repair");
  assert.match(app, /getServiceBySlug\(serviceDetailMatch\)/);
});
test("works initial render retains portfolio baseline", () => {
  assert.ok(WORKS_DATA.length >= 6);
  assert.match(works, /useState<WorkItem\[\]>\(WORKS_DATA\)/);
});
test("testimonials initial render retains static reviews", () => {
  assert.ok(TESTIMONIALS_DATA.length >= 3);
  assert.match(testimonials, /TESTIMONIALS_DATA/);
  assert.match(testimonials, /useState<Testimonial\[\]>\(TESTIMONIALS_DATA\)/);
  assert.doesNotMatch(testimonials, /localStorage|FileReader/);
  assert.match(testimonials, /fetch\('\/api\/reviews'/);
  assert.doesNotMatch(testimonials, /setTestimonials\(\(prev\).*newFeedback/);
});
test("empty API responses cannot replace static service and works data", () => {
  assert.match(app, /mapped\.length > 0/);
  assert.match(works, /mapped\.length > 0/);
});
test("empty API responses cannot replace static testimonials", () => {
  assert.match(
    testimonials,
    /records\.length\s*\?\s*sortNewestFirst\(records\)\s*:\s*TESTIMONIALS_DATA/,
  );
});
