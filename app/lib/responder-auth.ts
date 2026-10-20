import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const RESPONDER_COOKIE = "cs_responder";

function safeEqual(a: string, b: string) {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function passcodeMatches(input: string) {
  const passcode = process.env.RESPONDER_PASSCODE;
  return !!passcode && safeEqual(input, passcode);
}

// The session value is derived from the passcode, so changing the passcode
// signs every responder out.
export function sessionToken() {
  const passcode = process.env.RESPONDER_PASSCODE;
  if (!passcode) return null;
  return createHmac("sha256", passcode)
    .update("civicsignal-responder-session")
    .digest("hex");
}

export async function isResponder() {
  const expected = sessionToken();
  if (!expected) return false;

  const store = await cookies();
  const value = store.get(RESPONDER_COOKIE)?.value;
  return !!value && safeEqual(value, expected);
}