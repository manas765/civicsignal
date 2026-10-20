// Shape sent to the browser. It deliberately leaves out the raw analysis,
// the weather payload and the device hashes.
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
};

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
  };
}