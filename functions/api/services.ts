interface Env {
    KENER_API_TOKEN?: string;
    KENER_API_BASE_URL?: string;
    KENER_PAGE_PATH?: string;
}

type KenerStatus = "operational" | "degraded" | "outage" | "unknown";

interface KenerMonitor {
    tag?: unknown;
    name?: unknown;
    description?: unknown;
    status?: unknown;
    external_url?: unknown;
}

interface PublicService {
    name?: string;
    description?: string;
    url?: string;
    status: KenerStatus;
}

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
    const baseUrl = env.KENER_API_BASE_URL;
    const pagePath = env.KENER_PAGE_PATH;

    if (!token || !baseUrl || !pagePath || ids.length === 0) {
        return jsonResponse({ services });
    }

    try {
        const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v4/pages/${encodeURIComponent(pagePath)}`;
        const response = await fetch(endpoint, {
            headers: {
                accept: "application/json",
                authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return jsonResponse({ services });

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) return jsonResponse({ services });
        if (!("page" in payload) || typeof payload.page !== "object" || payload.page === null) {
            return jsonResponse({ services });
        }
        if (!("monitors" in payload.page) || !Array.isArray(payload.page.monitors)) {
            return jsonResponse({ services });
        }

        for (const monitor of payload.page.monitors as KenerMonitor[]) {
            if (typeof monitor !== "object" || monitor === null) continue;
            const tag = "tag" in monitor ? monitor.tag : undefined;
            if (typeof tag !== "string" || !ids.includes(tag)) continue;

            const service: PublicService = { status: mapStatus(monitor.status) };
            const name = "name" in monitor ? monitor.name : undefined;
            const description = "description" in monitor ? monitor.description : undefined;
            const externalUrl = "external_url" in monitor ? monitor.external_url : undefined;

            if (typeof name === "string" && name) service.name = name;
            if (typeof description === "string" && description) service.description = description;
            if (typeof externalUrl === "string" && externalUrl) service.url = externalUrl;

            services[tag] = service;
        }
    } catch {
        return jsonResponse({ services });
    }

    return jsonResponse({ services });
};
