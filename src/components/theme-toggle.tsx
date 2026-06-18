"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

// Light/dark toggle. Both icons are always rendered and swapped purely via the
// `dark:` CSS variant — no mount/effect state — so there's no hydration flash
// and no setState-in-effect. resolvedTheme is read only on click (client-side).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 scale-100 transition-transform dark:scale-0" />
      <Moon className="absolute h-4 w-4 scale-0 transition-transform dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
