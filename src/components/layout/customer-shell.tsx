import type { ReactNode } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { LogOut, User, Home, Package, AlertCircle, MessageSquare } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

const NAV = [
  { label: "Home", to: "/customer", exact: true },
  { label: "My Issues", to: "/customer/complaints" },
  { label: "AI Assistant", to: "/customer/chat" },
];

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  // Fetch customer name for display
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-shell-profile"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("customers")
        .select("full_name, email")
        .eq("profile_id", user.id)
        .maybeSingle();
      return data as { full_name: string; email: string } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Initials for avatar
  const initials =
    customerProfile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CU";

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    queryClient.clear();
    router.navigate({ to: "/login" });
  };

  const isChatRoute = pathname === "/customer/chat";

  return (
    <div
      className={cn(
        "bg-background",
        isChatRoute ? "h-screen w-screen overflow-hidden flex flex-col" : "min-h-screen",
      )}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur shrink-0">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5">
          <Link to="/customer" className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map((n) => {
              const isActive = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "rounded-sm px-2.5 py-1.5 text-[13px]",
                    isActive
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell mode="customer" />
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold hover:bg-surface-4 transition-colors"
              >
                {initials}
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
      <main
        className={cn(
          isChatRoute
            ? "flex-1 w-full overflow-hidden pb-14 md:pb-0"
            : "mx-auto max-w-[1600px] px-5 py-6 pb-20 md:pb-6",
        )}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="flex h-14 items-center justify-around px-2">
          {NAV.map((n) => {
            const isActive = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon =
              n.to === "/customer"
                ? Home
                : n.to === "/customer/complaints"
                  ? AlertCircle
                  : MessageSquare;

            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-1 text-[10px] transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")}
                />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {!isChatRoute && (
        <footer className="mx-auto max-w-[1600px] px-5 pb-8 text-xs text-muted-foreground">
          {customerProfile?.full_name
            ? `Signed in as ${customerProfile.full_name}`
            : customerProfile?.email
              ? `Signed in as ${customerProfile.email}`
              : "Signed in as Customer"}
        </footer>
      )}
    </div>
  );
}
