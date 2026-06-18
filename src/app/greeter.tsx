"use client";

import { useState } from "react";
import { generateGreeting } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Greeter() {
  const [name, setName] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runServerAction() {
    setPending(true);
    try {
      setActionResult(await generateGreeting(name));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name"
      />

      <Button onClick={runServerAction} disabled={pending}>
        {pending ? "Running…" : "Run Server Action"}
      </Button>

      {actionResult && (
        <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-md p-3 font-mono text-sm">
          {actionResult}
        </pre>
      )}
    </div>
  );
}
