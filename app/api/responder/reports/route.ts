import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { isResponder } from "../../../lib/responder-auth";

function unauthorized() {
  return NextResponse.json(
    { error: "Responder sign-in required." },
    { status: 401 }
  );
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
      "id, created_at, title, summary, location, category, severity, status, evidence, responder_note, analysis"
    )
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Responder list failed:", error);
    return NextResponse.json({ error: "Could not load reports." }, { status: 502 });
  }

  const reports = (data ?? []).map((row) => ({
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
    authorityMessage:
      (row.analysis as { authorityMessage?: string } | null)?.authorityMessage ?? "",
  }));

  return NextResponse.json({ reports });
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

  if (!id || !["confirm", "unconfirm", "hide"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let update: Record<string, unknown>;

  if (action === "confirm") {
    update = {
      status: "Officially Confirmed",
      responder_note: note || null,
      confirmed_at: new Date().toISOString(),
    };
  } else if (action === "unconfirm") {
    const { data: current } = await supabase
      .from("reports")
      .select("evidence")
      .eq("id", id)
      .single();

    const hasEvidence = Array.isArray(current?.evidence) && current.evidence.length > 0;
    update = {
      status: hasEvidence ? "Corroborated" : "Reported",
      responder_note: null,
      confirmed_at: null,
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