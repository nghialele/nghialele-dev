export type PresenceState = "online" | "idle" | "dnd" | "offline" | "unavailable";

export interface PresenceResult {
    state: PresenceState;
    activity?: string;
    displayName?: string;
}

function normalizePresence(payload: unknown): PresenceResult {
    if (
        typeof payload !== "object" ||
        payload === null ||
        !("success" in payload) ||
        payload.success !== true ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null
    ) {
        return { state: "unavailable" };
    }

    const data = payload.data;
    const status = "discord_status" in data ? data.discord_status : undefined;
    const state = typeof status === "string" && status in {
        online: true,
        idle: true,
        dnd: true,
        offline: true,
    }
        ? status as PresenceState
        : "unavailable";
    const user = "discord_user" in data && typeof data.discord_user === "object" && data.discord_user !== null
        ? data.discord_user
        : undefined;
    const displayName = user && "global_name" in user && typeof user.global_name === "string"
        ? user.global_name
        : user && "username" in user && typeof user.username === "string" ? user.username : undefined;
    const activities = "activities" in data && Array.isArray(data.activities) ? data.activities : [];
    const firstActivity = activities.find((activity) =>
        typeof activity === "object" && activity !== null && "name" in activity && typeof activity.name === "string"
    );

    return {
        state,
        displayName,
        activity: firstActivity && typeof firstActivity === "object" && "name" in firstActivity
            ? firstActivity.name as string
            : undefined,
    };
}

export async function fetchPresence(
    endpoint: string,
    userId: string,
    fetcher: typeof fetch = fetch,
): Promise<PresenceResult> {
    if (!endpoint || !userId) return { state: "unavailable" };

    try {
        const url = new URL(endpoint);
        url.pathname = `${url.pathname.replace(/\/$/, "")}/${encodeURIComponent(userId)}`;
        const response = await fetcher(url, { headers: { accept: "application/json" } });
        if (!response.ok) return { state: "unavailable" };
        return normalizePresence(await response.json());
    } catch {
        return { state: "unavailable" };
    }
}
