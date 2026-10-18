import type { ServiceStatus, ServiceStatusResult } from "./info";

const statusLabels: Record<ServiceStatus, string> = {
    operational: "Operational",
    degraded: "Degraded",
    outage: "Outage",
    unknown: "Status unavailable",
};

interface KenerMonitor {
    tag?: unknown;
    status?: unknown;
}

function normalizeStatus(value: unknown): ServiceStatus {
    if (value === "UP") return "operational";
    if (value === "DEGRADED") return "degraded";
    if (value === "DOWN") return "outage";
    return "unknown";
}

function parseMonitors(payload: unknown): KenerMonitor[] {
    if (
        typeof payload !== "object" ||
        payload === null ||
        !("page" in payload) ||
        typeof payload.page !== "object" ||
        payload.page === null ||
        !("monitors" in payload.page) ||
        !Array.isArray(payload.page.monitors)
    ) {
        return [];
    }
    return payload.page.monitors.filter((item): item is KenerMonitor => typeof item === "object" && item !== null);
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
    return AbortSignal.timeout(timeoutMs);
}

export async function fetchServiceStatuses(
    endpoint: string,
    monitorIds: string[],
    fetcher: typeof fetch = fetch,
): Promise<Record<string, ServiceStatusResult>> {
    const result: Record<string, ServiceStatusResult> = {};
    for (const monitorId of monitorIds) {
        result[monitorId] = { status: "unknown", label: statusLabels.unknown };
    }
    if (!endpoint || monitorIds.length === 0) return result;

    try {
        const response = await fetcher(endpoint, {
            headers: { accept: "application/json" },
            signal: createTimeoutSignal(5000),
        });
        if (!response.ok) return result;
        const monitors = parseMonitors(await response.json());
        for (const monitor of monitors) {
            if (typeof monitor.tag !== "string" || !monitorIds.includes(monitor.tag)) continue;
            const status = normalizeStatus(monitor.status);
            result[monitor.tag] = {
                status,
                label: statusLabels[status],
            };
        }
    } catch {
        return result;
    }
    return result;
}
