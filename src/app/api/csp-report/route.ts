import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.warn("[CSP Violation]", JSON.stringify(body));
  } catch {
    console.warn("[CSP Violation] Unparseable report received");
  }
  // A 204 No Content response must not have a body (Fetch spec's "null body status" list) —
  // NextResponse.json() always attaches one, which throws "Invalid response status code 204" at
  // request time. Only surfaced once something actually triggered a CSP report in production-like
  // conditions (Vercel's Preview-only injected toolbar does; the app's own code never has).
  return new NextResponse(null, { status: 204 });
}