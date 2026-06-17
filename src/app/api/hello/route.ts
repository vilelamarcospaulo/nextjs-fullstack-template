import { NextResponse } from "next/server";

// Backend HTTP surface. Exercised by the home page and reachable directly
// at GET /api/hello. This is where REST-style endpoints for the
// content-generator backend will live.
export async function GET() {
  return NextResponse.json({
    message: "Hello from the content-generator API.",
    timestamp: new Date().toISOString(),
  });
}
