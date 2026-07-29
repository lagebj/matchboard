import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.warn("[CSP Violation]", JSON.stringify(body));
  } catch {
    console.warn("[CSP Violation] Unparseable report received");
  }
  return NextResponse.json({ ok: true }, { status: 204 });
}