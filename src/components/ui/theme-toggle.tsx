import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DarkOps ThemeToggle - a compact, premium Sun/Moon icon toggle.
 * Reads and writes the active theme via next-themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface transition-colors hover:bg-surface-2 hover:text-foreground text-muted-foreground",
        className,
      )}
    >
      {/* Sun icon - visible in dark mode */}
      <Sun
        className={cn(
          "absolute size-4 transition-all duration-200",
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50",
        )}
      />
      {/* Moon icon - visible in light mode */}
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-200",
          isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
        )}
      />
    </button>
  );
}
