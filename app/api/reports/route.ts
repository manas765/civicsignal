import { NextResponse, connection } from "next/server";
import { getSupabase } from "../../lib/supabase";
import { toReportDto } from "../../lib/reports";

export async function GET() {
  // Always run at request time so every visitor sees the latest reports.
  await connection();

  const supabase = getSupabase();

  // Database not configured yet (for example, first local run).
  if (!supabase) {
    return NextResponse.json({ persisted: false, reports: [] });
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, created_at, title, summary, location, category, severity, status, lat, lon, evidence, responder_note"
    )
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Loading reports failed:", error);
    return NextResponse.json(
      { persisted: false, reports: [], error: "Could not load reports." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    persisted: true,
    reports: (data ?? []).map(toReportDto),
  });
}