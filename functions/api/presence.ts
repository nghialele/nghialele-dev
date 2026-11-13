interface Env {
    LANYARD_API_KEY?: string;
    LANYARD_API_BASE_URL?: string;
    LANYARD_USER_ID?: string;
}

type CacheStatus = "HIT" | "MISS" | "STALE" | "BYPASS";

interface Snapshot {
    payload: unknown;
    cachedAt: number;
}

// `caches.default` is a Workers extension; the DOM lib only types `caches` as CacheStorage.
declare const caches: CacheStorage & { default: Cache };

const CACHE_TTL_SECONDS = 15;
const CACHE_RETENTION_SECONDS = 60;
const CLIENT_MAX_AGE_SECONDS = 10;
const DEFAULT_BASE_URL = "https://api.lanyard.rest/v1/users";
const UNCONFIGURED = { success: false, error: { code: "unconfigured" } };
const UNAVAILABLE = { success: false, error: { code: "unavailable" } };

function jsonResponse(body: unknown, cacheStatus: CacheStatus): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": `public, max-age=${CLIENT_MAX_AGE_SECONDS}`,
            "x-cache": cacheStatus,
            "x-content-type-options": "nosniff",
        },
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
        if (key in source) out[key] = source[key];
    }
    return out;
}

// The upstream payload also carries the owner's Lanyard KV store, so return only
// the fields the client adapter reads.
function sanitize(payload: unknown): unknown {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) return UNAVAILABLE;

    const data = payload.data;
    const out: Record<string, unknown> = {
        active_on_discord_desktop: data.active_on_discord_desktop === true,
        active_on_discord_mobile: data.active_on_discord_mobile === true,
        active_on_discord_web: data.active_on_discord_web === true,
    };

    if (typeof data.discord_status === "string") out.discord_status = data.discord_status;

    if (isRecord(data.discord_user)) {
        out.discord_user = pick(data.discord_user, ["id", "username", "global_name", "avatar"]);
    }

    if (Array.isArray(data.activities)) {
        out.activities = data.activities.filter(isRecord).map((activity) => {
            const entry = pick(activity, ["type", "name", "details", "state", "application_id"]);
            if (isRecord(activity.assets)) entry.assets = pick(activity.assets, ["large_image"]);
            if (isRecord(activity.timestamps)) entry.timestamps = pick(activity.timestamps, ["start"]);
            return entry;
        });
    }

    if (isRecord(data.spotify)) {
        const spotify = pick(data.spotify, ["song", "artist", "album_art_url"]);
        if (isRecord(data.spotify.timestamps)) {
            spotify.timestamps = pick(data.spotify.timestamps, ["start", "end"]);
        }
        out.spotify = spotify;
    }

    return { success: true, data: out };
}

async function fetchPresence(baseUrl: string, userId: string, key: string): Promise<unknown> {
    const url = `${baseUrl}/${encodeURIComponent(userId)}`;
    try {
        const response = await fetch(url, {
            headers: { accept: "application/json", authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return UNAVAILABLE;
        return sanitize(await response.json());
    } catch {
        return UNAVAILABLE;
    }
}

function parseSnapshot(value: unknown): Snapshot | null {
    if (!isRecord(value)) return null;
    if (!("payload" in value) || !("cachedAt" in value)) return null;
    if (typeof value.cachedAt !== "number") return null;
    return { payload: value.payload, cachedAt: value.cachedAt };
}

export const onRequestGet = async ({
    request,
    env,
}: {
    request: Request;
    env: Env;
}): Promise<Response> => {
    const key = env.LANYARD_API_KEY;
    const userId = env.LANYARD_USER_ID?.trim();
    const baseUrl = (env.LANYARD_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

    if (!key || !userId) return jsonResponse(UNCONFIGURED, "BYPASS");

    const cache = caches.default;
    const cacheKey = new Request(new URL("/api/presence", request.url));

    let cached: Snapshot | null = null;
    const stored = await cache.match(cacheKey);
    if (stored) {
        try {
            cached = parseSnapshot(await stored.json());
        } catch {
            cached = null;
        }
    }

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_SECONDS * 1000) {
        return jsonResponse(cached.payload, "HIT");
    }

    const payload = await fetchPresence(baseUrl, userId, key);
    const failed = isRecord(payload) && payload.success === false;
    if (failed) {
        return cached ? jsonResponse(cached.payload, "STALE") : jsonResponse(UNAVAILABLE, "BYPASS");
    }

    await cache.put(
        cacheKey,
        new Response(JSON.stringify({ payload, cachedAt: Date.now() }), {
            headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": `public, max-age=${CACHE_RETENTION_SECONDS}`,
            },
        }),
    );

    return jsonResponse(payload, "MISS");
};
