import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { isResponder } from "../../../lib/responder-auth";

function unauthorized() {
  return NextResponse.json(
    { error: "Responder sign-in required." },
    { status: 401 }
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : Math.round(sorted[middle]);
}

type HistoryEvent = { event: string; at?: string };

// Reports saved before the history existed get a starting history, so
// adding an event never erases what we already knew.
function seedHistory(current: {
  created_at: string;
  status: string;
  confirmed_at: string | null;
  status_history: unknown;
}): HistoryEvent[] {
  if (Array.isArray(current.status_history) && current.status_history.length > 0) {
    return [...(current.status_history as HistoryEvent[])];
  }

  const seed: HistoryEvent[] = [{ event: "Reported", at: current.created_at }];
  if (current.status === "Corroborated" || current.status === "Officially Confirmed") {
    seed.push({ event: "Corroborated" });
  }
  if (current.status === "Officially Confirmed" && current.confirmed_at) {
    seed.push({ event: "Officially Confirmed", at: current.confirmed_at });
  }
  return seed;
}

export async function GET() {
  if (!(await isResponder())) return unauthorized();

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, created_at, title, summary, location, category, severity, status, evidence, responder_note, analysis, confirmed_at, resolved_at"
    )
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Responder list failed:", error);
    return NextResponse.json({ error: "Could not load reports." }, { status: 502 });
  }

  const rows = data ?? [];

  const reports = rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    summary: row.summary,
    location: row.location,
    category: row.category,
    severity: row.severity,
    status: row.status,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    responderNote: row.responder_note ?? null,
    resolvedAt: row.resolved_at ?? null,
    authorityMessage:
      (row.analysis as { authorityMessage?: string } | null)?.authorityMessage ?? "",
  }));

  // Simple numbers computed from the saved reports, never by the AI.
  const WINDOW_HOURS = 24;
  const since = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const recent = rows.filter((row) => new Date(row.created_at).getTime() >= since);
  const backedUp = recent.filter(
    (row) => row.status === "Corroborated" || row.status === "Officially Confirmed"
  );

  const minutesBetween = (from: string, to: string) =>
    Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

  const confirmTimes = rows
    .filter((row) => row.confirmed_at)
    .map((row) => minutesBetween(row.created_at, row.confirmed_at as string));
  const resolveTimes = rows
    .filter((row) => row.resolved_at)
    .map((row) => minutesBetween(row.created_at, row.resolved_at as string));

  const stats = {
    windowHours: WINDOW_HOURS,
    total: recent.length,
    corroboratedPct:
      recent.length > 0 ? Math.round((backedUp.length / recent.length) * 100) : null,
    confirmed: rows.filter((row) => row.status === "Officially Confirmed").length,
    resolved: rows.filter((row) => row.resolved_at).length,
    medianMinutesToConfirm: median(confirmTimes),
    medianMinutesToResolve: median(resolveTimes),
  };

  return NextResponse.json({ reports, stats });
}

export async function PATCH(request: Request) {
  if (!(await isResponder())) return unauthorized();

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : "";

  if (!id || !["confirm", "unconfirm", "resolve", "reopen", "hide"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: current, error: readError } = await supabase
    .from("reports")
    .select("created_at, status, evidence, confirmed_at, resolved_at, status_history")
    .eq("id", id)
    .single();

  if (readError || !current) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const history = seedHistory(current);
  let update: Record<string, unknown>;

  if (action === "confirm") {
    update = {
      status: "Officially Confirmed",
      responder_note: note || null,
      confirmed_at: nowIso,
      status_history: [...history, { event: "Officially Confirmed", at: nowIso }],
    };
  } else if (action === "unconfirm") {
    const hasEvidence = Array.isArray(current.evidence) && current.evidence.length > 0;
    update = {
      status: hasEvidence ? "Corroborated" : "Reported",
      responder_note: null,
      confirmed_at: null,
      status_history: [...history, { event: "Confirmation removed", at: nowIso }],
    };
  } else if (action === "resolve") {
    update = {
      resolved_at: nowIso,
      ...(note ? { responder_note: note } : {}),
      status_history: [...history, { event: "Resolved", at: nowIso }],
    };
  } else if (action === "reopen") {
    update = {
      resolved_at: null,
      status_history: [...history, { event: "Reopened", at: nowIso }],
    };
  } else {
    update = { hidden: true };
  }

  const { error } = await supabase.from("reports").update(update).eq("id", id);

  if (error) {
    console.error("Responder update failed:", error);
    return NextResponse.json({ error: "Could not update the report." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}