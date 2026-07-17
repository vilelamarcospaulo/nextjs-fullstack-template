import { NextResponse } from "next/server";

// Backend HTTP surface. Exercised by the home page and reachable directly
// at GET /api/hello. This is where REST-style endpoints for this
// template's backend will live.
export async function GET() {
  return NextResponse.json({
    message: "Hello from the Starter Kit API.",
    timestamp: new Date().toISOString(),
  });
}
