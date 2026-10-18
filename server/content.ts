import type pg from "pg";
import type {
  PageQuery,
  ServiceRecord,
  WorkRecord,
  WorksQuery,
  TestimonialRecord,
} from "../shared/api";
import { ApiError } from "./errors";

export interface ContentRepository {
  listServices(page: PageQuery): Promise<ServiceRecord[]>;
  listWorks(query: WorksQuery): Promise<WorkRecord[]>;
  listTestimonials(page: PageQuery): Promise<TestimonialRecord[]>;
}
export function createContentRepository(
  db: Pick<pg.Pool, "query">,
): ContentRepository {
  async function read<T extends pg.QueryResultRow>(
    sql: string,
    values: unknown[],
  ): Promise<T[]> {
    try {
      return (await db.query<T>(sql, values)).rows;
    } catch {
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "Please try again later. Content is unavailable.",
      );
    }
  }
  return {
    listServices: (page) =>
      read<ServiceRecord>(
        `SELECT id,slug,name,short_description,full_description,
      common_problems,service_process,cover_image FROM public.services WHERE is_active IS TRUE AND archived_at IS NULL
      ORDER BY id LIMIT $1 OFFSET $2`,
        [page.limit, page.offset],
      ),
    listWorks: async (query) =>
      (
        await read<WorkRecord>(
          `SELECT id,title,slug,service_type,service_id,category,description,media_url,
      media_type,is_featured,is_published,created_at FROM public.works WHERE is_published IS TRUE AND archived_at IS NULL
      AND ($1::text IS NULL OR category=$1) AND ($2::boolean IS NULL OR is_featured=$2)
      ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
          [
            query.category ?? null,
            query.featured ?? null,
            query.limit,
            query.offset,
          ],
        )
      ).map((row) => ({
        ...row,
        created_at: new Date(row.created_at).toISOString(),
      })),
    listTestimonials: async (page) =>
      (
        await read<TestimonialRecord>(
          `SELECT id,customer_name,review,service_type,service_id,address,rating,
      avatar_url,media_url,media_type,is_published,created_at FROM public.testimonials
      WHERE is_published IS TRUE AND archived_at IS NULL ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`,
          [page.limit, page.offset],
        )
      ).map((row) => ({
        ...row,
        created_at: new Date(row.created_at).toISOString(),
      })),
  };
}
