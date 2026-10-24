// Shape sent to the browser. It deliberately leaves out the raw analysis,
// the weather payload and the device hashes.
export type TimelineEvent = { event: string; at?: string };

export type ReportDto = {
  id: string;
  title: string;
  details: string;
  location: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
  lat?: number;
  lon?: number;
  evidence: string[];
  responderNote?: string;
  resolvedAt?: string;
  timeline: TimelineEvent[];
};

type ReportRow = {
  id: string;
  created_at: string;
  title: string;
  summary: string;
  location: string;
  category: string;
  severity: string;
  status: string;
  lat: number | null;
  lon: number | null;
  evidence?: unknown;
  responder_note?: string | null;
  confirmed_at?: string | null;
  resolved_at?: string | null;
  status_history?: unknown;
};

// Uses the saved history when there is one. Older reports saved before the
// history existed get a best-effort timeline from the dates we do have.
function buildTimeline(row: ReportRow): TimelineEvent[] {
  if (Array.isArray(row.status_history) && row.status_history.length > 0) {
    return row.status_history as TimelineEvent[];
  }

  const fallback: TimelineEvent[] = [{ event: "Reported", at: row.created_at }];
  if (row.status === "Corroborated") fallback.push({ event: "Corroborated" });
  if (row.confirmed_at) {
    fallback.push({ event: "Officially Confirmed", at: row.confirmed_at });
  }
  if (row.resolved_at) fallback.push({ event: "Resolved", at: row.resolved_at });
  return fallback;
}

export function toReportDto(row: ReportRow): ReportDto {
  return {
    id: row.id,
    title: row.title,
    details: row.summary,
    location: `${row.location} · User submitted`,
    category: row.category,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    evidence: Array.isArray(row.evidence) ? (row.evidence as string[]) : [],
    responderNote: row.responder_note ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    timeline: buildTimeline(row),
  };
}