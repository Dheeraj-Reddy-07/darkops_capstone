import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Settings, Shield, Users, FileText, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ADMIN_NAV = [
  { label: "Overview", to: "/admin", icon: Shield },
  { label: "Security Center", to: "/admin/security", icon: Shield },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Stores", to: "/dark-stores", icon: Store },
  { label: "Audit Logs", to: "/admin/audit-logs", icon: FileText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const { data: userProfile } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return profile as any;
    },
  });

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const initials =
    userProfile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "A";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <span className="label-caps hidden rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-primary lg:inline-block">
            Admin Console
          </span>

          <nav className="ml-2 flex items-center gap-0.5">
            {ADMIN_NAV.map((item) => {
              const active =
                pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-surface-3 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="num flex size-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-[13px]">{userProfile?.full_name || "Admin"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {userProfile?.role?.replace(/_/g, " ") || "System Administrator"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
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
