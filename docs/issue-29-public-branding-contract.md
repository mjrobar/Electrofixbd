# Public branding integration — frontend owner handoff

This is an additive API specification for Google AI Studio. No public frontend files were modified. Backend publication does not itself change the existing navbar, favicon or document title. Integrate only after the owner approves the public frontend/design change.

## Single source of truth

Use the existing endpoint:

```http
GET /api/site-content/business_settings
Cache-Control: no-store
```

Its existing shape is retained:

```json
{
  "success": true,
  "data": {
    "business_name": "Reviewed business name",
    "logo_url": "/api/media/00000000-0000-4000-a000-000000000000",
    "site_title": "Reviewed website title",
    "favicon_url": "/api/media/00000000-0000-4000-a000-000000000001"
  },
  "state": "published",
  "fallback_allowed": false,
  "updated_at": "2026-10-19T00:00:00Z"
}
```

UUIDs above are illustrative, not existing assets. `site_title` and `favicon_url` are optional additive fields; older published settings may omit them. All prior business/phone/address/social fields remain in the same draft and publication. Settings → Website branding and Website Content → Business settings edit the same row, guarded by the same revision. Do not create another public branding configuration.

| Published field | Intended frontend binding                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `business_name` | Existing navbar/site business name; preserve the approved layout, type scale and responsive behavior.                                                                                                                                      |
| `logo_url`      | Existing logo slot. Recommended source 512×512 square or 1200×400 horizontal; preserve proportions and appropriate accessible alt text.                                                                                                    |
| `site_title`    | Approved website title/base brand title. Reconcile existing per-page SEO titles with the frontend owner before changing their pattern. Use DOM text/title properties, never HTML injection.                                                |
| `favicon_url`   | Published uploaded source reference. For uploaded media, use PNG derivative endpoints below. Existing safe external/static URLs may be used directly after frontend review; the server never fetches remote images to produce derivatives. |

Honor the existing CMS initialization/publication contract: original static fallback is permitted only when the API explicitly allows it. After unpublish, remove the previously managed logo/icon/title value rather than retaining cached CMS media. Preserve per-page source behavior and do not silently resurrect an old publication after an empty response/network failure. See the [full public CMS contract](issue-21-public-cms-contract.md) for lifecycle rules and frontend acceptance.

## Favicon PNG derivatives

For a published uploaded `favicon_url`, these read-only endpoints return correctly sized real PNG files:

```text
/api/branding/favicon/48.png
/api/branding/favicon/192.png
/api/branding/favicon/512.png
```

Only sizes 48, 192 and 512 are supported. The selected asset must belong to Admin, exist in durable media storage, and be referenced by published Business settings with `state=published`. Draft uploads stay private. Unsupported sizes/unpublished/missing references return 404; unavailable durable storage or temporary encoder pressure fails without publishing anything. Responses use `image/png`, `nosniff`, `no-store` and a bounded server cache whose publication authorization is checked on every request.

Use the appropriate `rel=icon` sizes/type and a publication `updated_at` query version if browser favicon caching needs invalidation. Do not hardcode an asset UUID, point the public UI at `/api/admin/media/.../blob`, or insert an Admin preview URL into public metadata. ICO and SVG uploads are unsupported; new uploads accept PNG/JPEG/WebP and are validated/normalized to durable WebP originals. Published favicon PNGs are derived from those originals.

## Acceptance after separate approval

- Verify uninitialized/original fallback, draft-only changes, explicit publication, replacement and unpublish on a second device.
- Verify navbar geometry/alt text, transparent square/horizontal logos, 1×/2× displays and 48/192/512 icon dimensions. Preserve original public responsiveness and animations.
- Confirm no other Business settings fields change during branding saves, and revision conflicts preserve existing edits.
- Confirm private/unpublished media cannot be retrieved and published media remains durable after host restart/deployment. Vercel's temporary filesystem remains unsupported.
- Confirm no credential/provider configuration, private recovery address or customer data enters the public client.

The API and Admin paths were tested with synthetic fixtures/temporary image files. Real host, Supabase and public-design integration acceptance remain pending owner approval.
