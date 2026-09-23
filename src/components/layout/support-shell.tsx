import type { ReactNode } from "react";
import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { initialIdentity, fetchCurrentUser, isSupportLead } from "@/lib/current-user";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SupportShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    initialData: initialIdentity,
    staleTime: 60000,
  });

  const isLead = isSupportLead(me);

  const NAV = [
    {
      label: "Dashboard",
      to: "/support",
      match: (p: string) => !p.startsWith("/support/performance"),
    },
    ...(isLead
      ? [
          {
            label: "Team Performance",
            to: "/support/performance",
            match: (p: string) => p.startsWith("/support/performance"),
          },
        ]
      : []),
  ];

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    queryClient.clear();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5">
          <Link to="/support" className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <span className="label-caps hidden rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-primary lg:inline-block">
            Support Console
          </span>
          <nav className="ml-2 flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-[13px] transition-colors",
                  n.match(pathname)
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="num flex size-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  <User className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-[13px]">{me?.full_name || "Support Agent"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {isLead ? "Support Lead" : "Customer Support"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.navigate({ to: "/settings" })}>
                  <Settings className="mr-2 size-3.5" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="text-crit">
                  <LogOut className="mr-2 size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-5 py-5">{children}</main>
    </div>
  );
}
