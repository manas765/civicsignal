import { NextResponse } from "next/server";
import {
  RESPONDER_COOKIE,
  passcodeMatches,
  sessionToken,
} from "../../../lib/responder-auth";

export async function POST(request: Request) {
  if (!process.env.RESPONDER_PASSCODE) {
    return NextResponse.json(
      { error: "Responder access is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  if (!passcodeMatches(passcode)) {
    // A short delay slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(RESPONDER_COOKIE, sessionToken() as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}