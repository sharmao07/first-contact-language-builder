import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function readToken(request: Request) {
  return request.headers.get("x-participant-token");
}

export async function run(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      return json({ error: message || "Invalid input." }, 400);
    }
    console.error(error);
    return json({ error: "Unexpected server error." }, 500);
  }
}
