import assert from "node:assert/strict";
import { createHash } from "node:crypto";

type Source = { path: string; sha256: string };
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function assertSourceProvenance(source: Source, text: string, sourceRef: string) {
  // Git checkouts may use CRLF. The recorded source snapshot uses LF. Do not
  // trim, remove a BOM or normalize Unicode: other changes still require review.
  const normalized = sha256(text.replace(/\r\n/g, "\n"));
  assert.equal(normalized, source.sha256,
    `${source.path} differs from catalogue snapshot ${sourceRef} after CRLF-to-LF normalization. ` +
    `Raw SHA-256: ${sha256(text)}; LF SHA-256: ${normalized}; recorded SHA-256: ${source.sha256}. ` +
    "Review source mappings and imported values before updating the catalogue; do not refresh hashes alone.");
}
