// Framework-free scheduler so timing, cancellation and deduplication can be tested.
export function createAdminPoller(options: {
  allowed: () => boolean;
  task: (signal: AbortSignal) => Promise<void>;
  onError?: () => void;
  timers?: Pick<typeof globalThis, "setInterval" | "clearInterval">;
}) {
  const timers = options.timers || globalThis,
    controller = new AbortController();
  let busy = false,
    stopped = false;
  const tick = async () => {
    if (stopped || busy || !options.allowed()) return;
    busy = true;
    try {
      await options.task(controller.signal);
    } catch {
      if (!stopped) options.onError?.();
    } finally {
      busy = false;
    }
  };
  const interval = timers.setInterval(() => {
    void tick();
  }, 20_000);
  return {
    tick,
    stop() {
      stopped = true;
      controller.abort();
      timers.clearInterval(interval);
    },
  };
}
export type BookingFeed = {
  server_time: string;
  change_token: string;
  unread: number;
  total?: number;
  items: { booking_number: string; created_at: string }[];
  latest_cursor: string | null;
  read_state: string;
};
export type NotificationCheckpoint = {
  initialized: boolean;
  ids: string[];
  total?: number;
};
export async function fetchBookingFeed(
  get: (path: string) => Promise<BookingFeed>,
  seen: string | null,
  discardInvalid: () => void,
) {
  try {
    return await get(
      "/updates" + (seen ? "?seen=" + encodeURIComponent(seen) : ""),
    );
  } catch (e) {
    if (
      seen &&
      (e as any).status === 400 &&
      (e as any).code === "INVALID_CURSOR"
    ) {
      discardInvalid();
      return get("/updates");
    }
    throw e;
  }
}
export function bookingAlerts(
  previous: NotificationCheckpoint,
  feed: BookingFeed,
) {
  const known = new Set(previous.ids),
    fresh = previous.initialized
      ? feed.items.filter((i) => !known.has(i.booking_number))
      : [];
  return {
    fresh,
    count: previous.initialized
      ? Math.max(
          fresh.length,
          typeof feed.total === "number" && typeof previous.total === "number"
            ? feed.total - previous.total
            : 0,
        )
      : 0,
    checkpoint: {
      initialized: true,
      ...(typeof feed.total === "number" ? { total: feed.total } : {}),
      ids: [
        ...new Set([
          ...feed.items.map((i) => i.booking_number),
          ...previous.ids,
        ]),
      ].slice(0, 200),
    },
  };
}
export function readCheckpoint(raw: string | null): NotificationCheckpoint {
  try {
    const v = JSON.parse(raw || "null");
    if (
      v?.initialized === true &&
      Array.isArray(v.ids) &&
      v.ids.every(
        (id: unknown) => typeof id === "string" && /^EFB-\d{8}-\d{5}$/.test(id),
      )
    )
      return {
        initialized: true,
        ids: v.ids.slice(0, 200),
        ...(Number.isSafeInteger(v.total) && v.total >= 0
          ? { total: v.total }
          : {}),
      };
  } catch {
    /* private/storage-disabled mode */
  }
  return { initialized: false, ids: [] };
}
