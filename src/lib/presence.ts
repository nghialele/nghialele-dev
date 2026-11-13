/** Both a user ID and a key are required; either one missing means no presence at all. */
export function presenceConfigured(): boolean {
    return Boolean(import.meta.env.PUBLIC_LANYARD_USER_ID && import.meta.env.PUBLIC_LANYARD_KEY);
}

export type PresenceState = "online" | "idle" | "dnd" | "offline" | "unavailable";

export interface PresenceActivity {
    name: string;
    details?: string;
    state?: string;
    startedAt?: number;
    imageUrl?: string;
}

export interface SpotifyPresence {
    song: string;
    artist: string;
    albumArtUrl?: string;
    startedAt?: number;
    endsAt?: number;
}

export interface PresenceResult {
    state: PresenceState;
    displayName?: string;
    avatarUrl?: string;
    customStatus?: string;
    activity?: PresenceActivity;
    spotify?: SpotifyPresence;
    devices: { desktop: boolean; mobile: boolean; web: boolean };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function asTimestamp(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function unavailable(): PresenceResult {
    return { state: "unavailable", devices: { desktop: false, mobile: false, web: false } };
}

function avatarUrl(user: Record<string, unknown>): string | undefined {
    const id = asString(user.id);
    if (!id) return undefined;
    const avatar = asString(user.avatar);
    if (avatar) {
        const ext = avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=96`;
    }
    try {
        return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> BigInt(22)) % BigInt(6))}.png`;
    } catch {
        return undefined;
    }
}

function activityImage(activity: Record<string, unknown>): string | undefined {
    const assets = isRecord(activity.assets) ? activity.assets : undefined;
    const image = assets ? asString(assets.large_image) : undefined;
    if (!image || image.startsWith("spotify:")) return undefined;
    if (image.startsWith("mp:external/")) {
        return `https://media.discordapp.net/external/${image.slice("mp:external/".length)}`;
    }
    const applicationId = asString(activity.application_id);
    return applicationId ? `https://cdn.discordapp.com/app-assets/${applicationId}/${image}.png` : undefined;
}

function normalizePresence(payload: unknown): PresenceResult {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) return unavailable();

    const data = payload.data;
    const rawStatus = asString(data.discord_status);
    const state: PresenceState =
        rawStatus === "online" || rawStatus === "idle" || rawStatus === "dnd" || rawStatus === "offline"
            ? rawStatus
            : "unavailable";

    const user = isRecord(data.discord_user) ? data.discord_user : undefined;
    const username = user ? asString(user.username) : undefined;
    const displayName = user ? asString(user.global_name) ?? username : undefined;

    const activities = Array.isArray(data.activities) ? data.activities.filter(isRecord) : [];
    const custom = activities.find((activity) => activity.type === 4 && typeof activity.state === "string");
    const customStatus = custom ? asString(custom.state) : undefined;
    const main = activities.find(
        (activity) => activity.type !== 4 && activity.type !== 2 && typeof activity.name === "string",
    );
    const activity: PresenceActivity | undefined = main
        ? {
              name: asString(main.name) ?? "",
              details: asString(main.details),
              state: asString(main.state),
              startedAt: isRecord(main.timestamps) ? asTimestamp(main.timestamps.start) : undefined,
              imageUrl: activityImage(main),
          }
        : undefined;

    let spotify: SpotifyPresence | undefined;
    const rawSpotify = isRecord(data.spotify) ? data.spotify : undefined;
    if (rawSpotify && typeof rawSpotify.song === "string") {
        const timestamps = isRecord(rawSpotify.timestamps) ? rawSpotify.timestamps : undefined;
        spotify = {
            song: rawSpotify.song,
            artist: (asString(rawSpotify.artist) ?? "")
                .split(";")
                .map((part) => part.trim())
                .filter(Boolean)
                .join(", "),
            albumArtUrl: asString(rawSpotify.album_art_url),
            startedAt: timestamps ? asTimestamp(timestamps.start) : undefined,
            endsAt: timestamps ? asTimestamp(timestamps.end) : undefined,
        };
    }

    return {
        state,
        displayName,
        avatarUrl: user ? avatarUrl(user) : undefined,
        customStatus,
        activity,
        spotify,
        devices: {
            desktop: data.active_on_discord_desktop === true,
            mobile: data.active_on_discord_mobile === true,
            web: data.active_on_discord_web === true,
        },
    };
}

export async function fetchPresence(
    endpoint: string,
    userId: string,
    key: string,
    fetcher: typeof fetch = fetch,
): Promise<PresenceResult> {
    if (!endpoint || !userId || !key) return unavailable();
    try {
        const url = new URL(`${endpoint.replace(/\/$/, "")}/${encodeURIComponent(userId)}`);
        url.searchParams.set("key", key);
        const response = await fetcher(url, { headers: { accept: "application/json" }, cache: "no-store" });
        if (!response.ok) return unavailable();
        return normalizePresence(await response.json());
    } catch {
        return unavailable();
    }
}
