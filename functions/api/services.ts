interface Env {
    KENER_API_TOKEN?: string;
    KENER_API_BASE_URL?: string;
    KENER_PAGE_PATH?: string;
}

type KenerStatus = "operational" | "degraded" | "outage" | "unknown";

interface PublicService {
    name?: string;
    description?: string;
    url?: string;
    status: KenerStatus;
    position: number;
}

interface PageMember {
    tag: string;
    position: number;
}

const DATA_WINDOW_SECONDS = 86400;

function mapStatus(value: unknown): KenerStatus {
    if (value === "UP") return "operational";
    if (value === "DEGRADED" || value === "MAINTENANCE") return "degraded";
    if (value === "DOWN") return "outage";
    return "unknown";
}

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=30",
            "x-content-type-options": "nosniff",
        },
    });
}

function latestStatus(data: unknown, fallback: unknown): KenerStatus {
    if (Array.isArray(data) && data.length > 0) {
        for (let index = data.length - 1; index >= 0; index -= 1) {
            const point = data[index];
            if (typeof point === "object" && point !== null && "status" in point) {
                return mapStatus(point.status);
            }
        }
    }
    return mapStatus(fallback);
}

async function fetchMonitorStatus(
    baseUrl: string,
    tag: string,
    fallback: unknown,
    headers: HeadersInit,
): Promise<KenerStatus> {
    const now = Math.floor(Date.now() / 1000);
    const url = `${baseUrl}/api/v4/monitors/${encodeURIComponent(tag)}/data?start_ts=${now - DATA_WINDOW_SECONDS}&end_ts=${now}`;

    try {
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
        if (!response.ok) return mapStatus(fallback);
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("data" in payload)) {
            return mapStatus(fallback);
        }
        return latestStatus(payload.data, fallback);
    } catch {
        return mapStatus(fallback);
    }
}

async function fetchPageMembers(
    baseUrl: string,
    pagePath: string,
    headers: HeadersInit,
): Promise<PageMember[] | null> {
    try {
        const response = await fetch(`${baseUrl}/api/v4/pages/${encodeURIComponent(pagePath)}`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("page" in payload)) return null;

        const page = payload.page;
        if (typeof page !== "object" || page === null || !("monitors" in page)) return null;
        if (!Array.isArray(page.monitors)) return null;

        const members: PageMember[] = [];
        for (const monitor of page.monitors) {
            if (typeof monitor !== "object" || monitor === null) continue;
            if (!("monitor_tag" in monitor) || typeof monitor.monitor_tag !== "string") continue;

            const tag = monitor.monitor_tag.trim();
            if (!tag) continue;

            const position =
                "position" in monitor && typeof monitor.position === "number" ? monitor.position : 0;
            members.push({ tag, position });
        }

        members.sort((a, b) => a.position - b.position);
        return members;
    } catch {
        return null;
    }
}

export const onRequestGet = async ({ env }: { request: Request; env: Env }): Promise<Response> => {
    const token = env.KENER_API_TOKEN;
    const baseUrl = env.KENER_API_BASE_URL?.replace(/\/$/, "");
    const pagePath = env.KENER_PAGE_PATH?.trim();

    if (!token || !baseUrl || !pagePath) {
        return jsonResponse({ services: {}, pageResolved: false });
    }

    const headers: HeadersInit = {
        accept: "application/json",
        authorization: `Bearer ${token}`,
    };

    const members = await fetchPageMembers(baseUrl, pagePath, headers);
    if (!members) return jsonResponse({ services: {}, pageResolved: false });
    if (members.length === 0) return jsonResponse({ services: {}, pageResolved: true });

    try {
        const response = await fetch(`${baseUrl}/api/v4/monitors`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return jsonResponse({ services: {}, pageResolved: false });

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("monitors" in payload)) {
            return jsonResponse({ services: {}, pageResolved: false });
        }
        if (!Array.isArray(payload.monitors)) {
            return jsonResponse({ services: {}, pageResolved: false });
        }

        const byTag = new Map<string, Record<string, unknown>>();
        for (const monitor of payload.monitors) {
            if (typeof monitor !== "object" || monitor === null) continue;
            if (!("tag" in monitor) || typeof monitor.tag !== "string") continue;
            byTag.set(monitor.tag, monitor as Record<string, unknown>);
        }

        const entries = await Promise.all(
            members.map(async (member): Promise<[string, PublicService] | null> => {
                const monitor = byTag.get(member.tag);
                if (!monitor) return null;
                if (monitor.is_hidden === "YES") return null;

                const service: PublicService = {
                    status: await fetchMonitorStatus(
                        baseUrl,
                        member.tag,
                        monitor.default_status,
                        headers,
                    ),
                    position: member.position,
                };

                if (typeof monitor.name === "string" && monitor.name.trim()) {
                    service.name = monitor.name.trim();
                }
                if (typeof monitor.description === "string" && monitor.description.trim()) {
                    service.description = monitor.description.trim();
                }
                if (typeof monitor.external_url === "string" && monitor.external_url) {
                    service.url = monitor.external_url;
                }

                return [member.tag, service];
            }),
        );

        const services: Record<string, PublicService> = {};
        for (const entry of entries) {
            if (entry) services[entry[0]] = entry[1];
        }

        return jsonResponse({ services, pageResolved: true });
    } catch {
        return jsonResponse({ services: {}, pageResolved: false });
    }
};
