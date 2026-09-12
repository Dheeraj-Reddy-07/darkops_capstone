import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * DarkOps ThemeProvider — wraps `next-themes` to provide:
 * - Dark (default) and Light modes
 * - Persistent preference in localStorage
 * - No flash of incorrect theme (SSR-safe via attribute strategy)
 * - Class-based toggle: `.dark` on `<html>`
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="darkops-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
