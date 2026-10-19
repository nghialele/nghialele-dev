interface Env {
    KENER_API_TOKEN?: string;
    KENER_API_BASE_URL?: string;
}

type KenerStatus = "operational" | "degraded" | "outage" | "unknown";

interface PublicService {
    name?: string;
    description?: string;
    url?: string;
    status: KenerStatus;
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

export const onRequestGet = async ({
    request,
    env,
}: {
    request: Request;
    env: Env;
}): Promise<Response> => {
    const services: Record<string, PublicService> = {};
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    const token = env.KENER_API_TOKEN;
    const baseUrl = env.KENER_API_BASE_URL?.replace(/\/$/, "");

    if (!token || !baseUrl || ids.length === 0) {
        return jsonResponse({ services });
    }

    const headers: HeadersInit = {
        accept: "application/json",
        authorization: `Bearer ${token}`,
    };

    try {
        const response = await fetch(`${baseUrl}/api/v4/monitors`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return jsonResponse({ services });

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("monitors" in payload)) {
            return jsonResponse({ services });
        }
        if (!Array.isArray(payload.monitors)) return jsonResponse({ services });

        const matched = payload.monitors.filter((monitor: unknown) => {
            if (typeof monitor !== "object" || monitor === null) return false;
            if (!("tag" in monitor) || typeof monitor.tag !== "string") return false;
            if (!ids.includes(monitor.tag)) return false;
            return !("is_hidden" in monitor) || monitor.is_hidden !== "YES";
        });

        await Promise.all(
            matched.map(async (monitor: Record<string, unknown>) => {
                const tag = monitor.tag as string;
                const service: PublicService = {
                    status: await fetchMonitorStatus(baseUrl, tag, monitor.default_status, headers),
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

                services[tag] = service;
            }),
        );
    } catch {
        return jsonResponse({ services });
    }

    return jsonResponse({ services });
};
