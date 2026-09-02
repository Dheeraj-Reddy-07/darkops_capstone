import type { ReactNode } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { ArrowUpRight, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";

const NAV = [
  { label: "Home", to: "/customer" },
  { label: "Support", to: "/customer/support" },
];

export function CustomerShell({ children }: { children: ReactNode }) {
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
          <Link to="/customer" className="flex items-center gap-2.5">
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
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold hover:bg-surface-4 transition-colors"
              >
                CU
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-sm border border-border bg-surface shadow-lg">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.navigate({ to: "/customer/profile" });
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                    >
                      <User className="size-4" />
                      Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-6">{children}</main>
      <footer className="mx-auto max-w-4xl px-5 pb-8 text-xs text-muted-foreground">
        Signed in as Customer
      </footer>
    </div>
  );
}
