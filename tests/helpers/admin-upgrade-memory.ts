// Database-free protocol fixture. Never constructs a pg.Client/Pool or opens a socket.
import assert from "node:assert/strict";
import type pg from "pg";
import type { Owner } from "../../server/admin-identity";
export function adminMemory(initialOwner: Owner | null) {
  let state = {
    owner: structuredClone(initialOwner),
    sessions: new Map<string, any>(),
    tokens: new Map<string, any>(),
    jobs: new Map<string, any>(),
    audits: [] as any[],
    seen: null as any,
  };
  let backup: typeof state | null = null;
  const queries: { sql: string; values: any[] }[] = [];
  const client = {
    release() {},
    async query(sql: string, values: any[] = []): Promise<any> {
      queries.push({ sql, values });
      assert.equal(
        Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))),
        values.length,
        sql,
      );
      if (sql === "BEGIN") {
        backup = structuredClone(state);
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        if (backup) state = backup;
        backup = null;
        return { rows: [] };
      }
      if (sql === "COMMIT") {
        backup = null;
        return { rows: [] };
      }
      if (sql.startsWith("SET ") || sql.includes("pg_advisory_xact_lock"))
        return { rows: [] };
      if (sql.startsWith("SELECT username,password_hash"))
        return { rows: state.owner ? [structuredClone(state.owner)] : [] };
      if (sql.startsWith("INSERT INTO public.admin_sessions")) {
        state.sessions.set(values[0], {
          version: values[1],
          expires: Date.now() + 8 * 3600000,
          seen: Date.now(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("DELETE FROM public.admin_sessions")) {
        if (sql.includes("token_hash=$1")) state.sessions.delete(values[0]);
        else if (values.length) {
          for (const [key, s] of state.sessions)
            if (
              s.version !== values[0] ||
              s.expires <= Date.now() ||
              s.seen < Date.now() - 30 * 60000
            )
              state.sessions.delete(key);
        } else state.sessions.clear();
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE public.admin_sessions")) {
        const session = state.sessions.get(values[0]);
        if (
          !session ||
          session.version !== values[1] ||
          session.expires <= Date.now() ||
          session.seen <= Date.now() - 30 * 60000
        )
          return { rows: [], rowCount: 0 };
        session.seen = Date.now();
        return { rows: [{ token_hash: values[0] }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE public.admin_owner")) {
        assert.ok(state.owner);
        if (sql.includes("password_hash=$1"))
          state.owner.password_hash = values[0];
        if (sql.includes("verified_email=$1")) {
          state.owner.verified_email = values[0];
          state.owner.email_verified_at = new Date().toISOString();
        }
        state.owner.credential_revision++;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("INSERT INTO public.admin_account_tokens")) {
        state.tokens.set(values[0], {
          purpose: values[1],
          email: values[2],
          credential_version: values[3],
          expires_at: values[4],
          used_at: null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("SELECT purpose,email,credential_version")) {
        const action = state.tokens.get(values[0]),
          purpose = sql.includes("purpose='verify_email'")
            ? "verify_email"
            : "reset_password";
        return {
          rows:
            action &&
            !action.used_at &&
            action.purpose === purpose &&
            Date.parse(action.expires_at) > Date.now()
              ? [structuredClone(action)]
              : [],
          rowCount: action ? 1 : 0,
        };
      }
      if (sql.startsWith("UPDATE public.admin_account_tokens")) {
        for (const action of state.tokens.values())
          if (!action.used_at) action.used_at = new Date().toISOString();
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO public.admin_delivery_outbox")) {
        if ([...state.jobs.values()].some((j) => j.dedupe_key === values[1]))
          return { rows: [], rowCount: 0 };
        state.jobs.set(values[0], {
          id: values[0],
          dedupe_key: values[1],
          channel: values[2],
          payload: values[3],
          expires_at: values[4],
          state: "queued",
          attempts: 0,
          available_at: 0,
        });
        return { rows: [{ id: values[0] }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE public.admin_delivery_outbox")) {
        if (sql.includes("SET state='cancelled'")) {
          for (const job of state.jobs.values())
            if (
              job.channel === "email" &&
              job.dedupe_key.startsWith("owner-action:") &&
              ["queued", "retry"].includes(job.state)
            ) {
              job.state = "cancelled";
              job.payload = null;
            }
          return { rows: [] };
        }
        if (sql.includes("SET state='processing'")) {
          assert.match(sql, /FOR UPDATE SKIP LOCKED/);
          const job = [...state.jobs.values()].find(
            (j) =>
              ["queued", "retry"].includes(j.state) &&
              j.attempts < 5 &&
              Date.parse(j.expires_at) > Date.now() &&
              j.available_at <= Date.now() &&
              values[0].includes(j.channel),
          );
          if (!job) return { rows: [] };
          job.state = "processing";
          job.attempts++;
          job.locked_at = Date.now();
          return { rows: [structuredClone(job)] };
        }
        if (sql.includes("WORKER_INTERRUPTED")) {
          for (const job of state.jobs.values())
            if (
              job.state === "processing" &&
              job.locked_at < Date.now() - 120000
            ) {
              job.state =
                job.channel === "email" && job.attempts < 5
                  ? "retry"
                  : "uncertain";
              job.last_code = "WORKER_INTERRUPTED";
            }
          return { rows: [] };
        }
        if (sql.includes("last_code='EXPIRED'")) {
          for (const job of state.jobs.values())
            if (
              Date.parse(job.expires_at) <= Date.now() &&
              ["queued", "retry"].includes(job.state)
            ) {
              job.state = "failed";
              job.payload = null;
            }
          return { rows: [] };
        }
        if (sql.includes("SET state=$1")) {
          const job = state.jobs.get(values[4]);
          assert.equal(job?.state, "processing");
          job.state = values[0];
          job.last_code = values[1];
          job.provider_id = values[2];
          job.available_at = Date.now() + values[3] * 1000;
          if (["sent", "failed"].includes(job.state)) job.payload = null;
          return { rows: [], rowCount: 1 };
        }
      }
      if (sql.startsWith("INSERT INTO public.admin_audit")) {
        state.audits.push(values);
        return { rows: [] };
      }
      if (sql.startsWith("SELECT channel,state,count")) {
        const counts = new Map<string, any>();
        for (const j of state.jobs.values()) {
          const k = j.channel + ":" + j.state;
          const row = counts.get(k) || {
            channel: j.channel,
            state: j.state,
            total: 0,
          };
          row.total++;
          counts.set(k, row);
        }
        return { rows: [...counts.values()] };
      }
      if (sql.startsWith("INSERT INTO public.admin_notification_state")) {
        if (
          !state.seen ||
          values[2] > state.seen.total ||
          (values[2] === state.seen.total && values[1] > state.seen.booking)
        )
          state.seen = { at: values[0], booking: values[1], total: values[2] };
        return { rows: [] };
      }
      throw Error("Unexpected fixture SQL: " + sql);
    },
  };
  return {
    pool: {
      query: client.query,
      connect: async () => client,
      on() {},
    } as unknown as pg.Pool,
    queries,
    get state() {
      return state;
    },
  };
}
