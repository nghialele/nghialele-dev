export type KenerStatus = "operational" | "degraded" | "outage" | "unknown";

export interface KenerService {
    name?: string;
    description?: string;
    url?: string;
    status: KenerStatus;
    position: number;
}

export interface KenerServicesResult {
    services: Record<string, KenerService>;
    pageResolved: boolean;
}

export const kenerStatusLabels: Record<KenerStatus, string> = {
    operational: "Operational",
    degraded: "Degraded",
    outage: "Outage",
    unknown: "Status unavailable",
};

const statuses: Record<string, KenerStatus> = {
    operational: "operational",
    degraded: "degraded",
    outage: "outage",
    unknown: "unknown",
};

const EMPTY: KenerServicesResult = { services: {}, pageResolved: false };

function toService(value: unknown): KenerService | undefined {
    if (typeof value !== "object" || value === null) return undefined;

    const status = "status" in value && typeof value.status === "string" ? value.status : "";
    const service: KenerService = {
        status: statuses[status] ?? "unknown",
        position: "position" in value && typeof value.position === "number" ? value.position : 0,
    };

    if ("name" in value && typeof value.name === "string" && value.name) service.name = value.name;
    if ("description" in value && typeof value.description === "string" && value.description) {
        service.description = value.description;
    }
    if ("url" in value && typeof value.url === "string" && value.url) service.url = value.url;

    return service;
}

export async function fetchKenerServices(
    endpoint: string,
    fetcher: typeof fetch = fetch,
): Promise<KenerServicesResult> {
    if (!endpoint) return EMPTY;

    try {
        const response = await fetcher(endpoint, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return EMPTY;

        const payload: unknown = await response.json();
        if (
            typeof payload !== "object" ||
            payload === null ||
            !("services" in payload) ||
            typeof payload.services !== "object" ||
            payload.services === null
        ) {
            return EMPTY;
        }

        const services: Record<string, KenerService> = {};
        for (const [tag, value] of Object.entries(payload.services)) {
            const service = toService(value);
            if (service) services[tag] = service;
        }

        return { services, pageResolved: "pageResolved" in payload && payload.pageResolved === true };
    } catch {
        return EMPTY;
    }
}
