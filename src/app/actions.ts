"use server";

// Server Action: runs only on the server, callable directly from Client
// Components without defining an HTTP endpoint. This is the path that future
// content-generation calls (e.g. invoking an LLM) would use.
export async function generateGreeting(name: string): Promise<string> {
  const trimmed = name.trim();
  const who = trimmed.length > 0 ? trimmed : "world";
  return `Hello, ${who} — generated on the server at ${new Date().toISOString()}.`;
}
