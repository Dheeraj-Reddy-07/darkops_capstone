import type { ReactNode } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";

const NAV = [
  { label: "Dashboard", to: "/support" },
];

export function SupportShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-5">
          <Link to="/support" className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-sm px-2.5 py-1.5 text-[13px]",
                  pathname === n.to
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold"
            >
              <User className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-5 top-14 z-50 w-48 rounded-md border border-border bg-background p-2 shadow-lg">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-surface-3"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-5 py-5">{children}</main>
    </div>
  );
}
