import { timingSafeEqual } from "crypto";
import { HttpError } from "@/lib/http";

export const OPERATOR_HEADER = "x-demo-operator";

export function demoOperatorGate() {
  const hosted = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  const forcedOff = process.env.DEMO_OPERATOR_DISABLED === "1";
  const enabledFlag = process.env.ALLOW_DEMO_OPERATOR === "1";
  const secret = process.env.DEMO_OPERATOR_SECRET ?? "";
  const available = !hosted && !forcedOff && enabledFlag && secret.length >= 24;
  return { available, hosted, forcedOff, enabledFlag, secret: available ? secret : "" };
}

function sameHost(origin: string, requestHost: string) {
  try {
    const host = new URL(origin).host;
    return host === requestHost || host === "127.0.0.1:3010" || host === "localhost:3010";
  } catch {
    return false;
  }
}

export function assertDemoOperator(request: Request) {
  const gate = demoOperatorGate();
  if (!gate.available) throw new HttpError(403, "Demo operator actions are disabled.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new HttpError(403, "Cross-origin demo requests are refused.");
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host") ?? "";
  if (origin && !sameHost(origin, requestHost)) throw new HttpError(403, "Cross-origin demo requests are refused.");
  const presented = request.headers.get(OPERATOR_HEADER) ?? "";
  const left = Buffer.from(presented);
  const right = Buffer.from(gate.secret);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new HttpError(401, "Operator authorization is required.");
  }
}
