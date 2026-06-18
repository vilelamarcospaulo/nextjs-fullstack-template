"use client";

// App-wide client providers. next-themes drives the class-based `.dark` variant
// (see globals.css `@custom-variant dark`) with light/dark/system support.
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
