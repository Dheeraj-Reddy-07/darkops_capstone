import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, User, Settings, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { normalizeRole, getLandingRoute } from "@/lib/auth-utils";

import { useNotifications, useUnreadCount, useMarkAsRead } from "@/hooks/useNotifications";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const NAV_BY_ROLE: Record<string, Array<{ label: string; to: string; match?: string; exact?: boolean }>> = {
  PLATFORM_ADMIN: [
    { label: "Overview", to: "/admin", exact: true },
    { label: "Users", to: "/admin/users" },
    { label: "Stores", to: "/dark-stores" },
    { label: "Audit", to: "/admin/audit" },
  ],
  EXECUTIVE: [
    { label: "Executive", to: "/executive", exact: true },
    { label: "Dark Stores", to: "/dark-stores" },
  ],
  OPERATIONS: [
    { label: "Operations", to: "/operations", exact: true },
    { label: "Dark Stores", to: "/dark-stores" },
  ],
  CUSTOMER_SUPPORT: [{ label: "My Queue", to: "/support" }],
  STORE_MANAGER: [{ label: "My Store", to: "/dark-stores" }],
  CUSTOMER: [], // Customer uses separate shell
};

const DEFAULT_NAV = [
  { label: "Executive", to: "/executive", exact: true },
  { label: "Operations", to: "/operations", exact: true },
  { label: "Cases", to: "/operations", match: "/cases" },
  { label: "Dark Store", to: "/dark-stores" },
  { label: "Fraud", to: "/fraud" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Fetch current user profile
  const { data: userProfile, isLoading } = useQuery({
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

      return profile as any; // Type assertion for now
    },
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsData, setSettingsData] = useState({
    full_name: "",
    hub_city: "",
  });

  // Fetch notifications
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkAsRead();

  const normalizedRole = normalizeRole(userProfile?.role);
  const userRole = normalizedRole || userProfile?.role;
  const navItems = userRole ? NAV_BY_ROLE[userRole] || [] : isLoading ? [] : [];

  // Use canonical landing route from auth-utils
  const defaultPath = getLandingRoute(userRole) || "/executive";

  // Workspace label shown in the navbar (role-contextual)
  const workspaceLabel =
    userRole === "CUSTOMER_SUPPORT"
      ? "Support"
      : userRole === "OPERATIONS"
        ? "Operations"
        : userRole === "STORE_MANAGER"
          ? "Store Ops"
          : userRole === "EXECUTIVE"
            ? "Executive"
            : userRole === "FRAUD_ANALYST"
              ? "Fraud"
              : userRole === "PLATFORM_ADMIN"
                ? "Admin"
                : "Operational Intelligence";

  // Roles that should have search access (can search stores, cases, complaints)
  const canSearch = [
    "PLATFORM_ADMIN",
    "EXECUTIVE",
    "OPERATIONS",
    "STORE_MANAGER",
    "CUSTOMER_SUPPORT",
    "FRAUD_ANALYST",
  ].includes(userRole || "");

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Clear React Query cache to prevent stale data after logout
    queryClient.clear();
    navigate({ to: "/login" });
  };

  const handleSettingsOpen = () => {
    setSettingsData({
      full_name: userProfile?.full_name || "",
      hub_city: userProfile?.hub_city || userProfile?.city || "",
    });
    setSettingsOpen(true);
  };

  const handleSettingsSave = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from("profiles") as any)
      .update({
        full_name: settingsData.full_name,
        hub_city: settingsData.hub_city,
      })
      .eq("id", user.id);

    // Invalidate profile query to refetch
    queryClient.invalidateQueries({ queryKey: ["current-user-profile"] });
    setSettingsOpen(false);
  };

  const handleSettingsCancel = () => {
    setSettingsOpen(false);
  };

  const isActive = (item: any) => {
    const base = "match" in item && item.match ? item.match : item.to;
    if (item.exact) {
      return pathname === base;
    }
    return pathname.startsWith(base);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5">
          <Link to={defaultPath} className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <span className="label-caps hidden rounded-sm border border-border px-2 py-1 lg:inline-block">
            {workspaceLabel}
          </span>

          <nav className="ml-2 flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-[13px] transition-colors",
                  isActive(item)
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  {unreadCount && unreadCount > 0 ? (
                    <span className="num absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="label-caps">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications && notifications.length > 0 ? (
                  <div className="flex flex-col max-h-96 overflow-y-auto">
                    {notifications.slice(0, 10).map((notification: any) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                        onSelect={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                          if (notification.link_type === "complaint") {
                            navigate({ to: "/cases/$id", params: { id: notification.link_ref } });
                          } else if (notification.link_type === "support_ticket") {
                            navigate({
                              to: "/support/tickets/$id",
                              params: { id: notification.link_ref },
                            });
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              !notification.is_read ? "bg-primary" : "bg-transparent",
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs truncate",
                              !notification.is_read ? "font-medium" : "text-muted-foreground",
                            )}
                          >
                            {notification.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground ml-4 line-clamp-2">
                          {notification.meta}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-[13px] text-muted-foreground">
                    No new notifications
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="num flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold">
                  {userProfile?.full_name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase() || "U"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-[13px]">{userProfile?.full_name || "User"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {userProfile?.role?.replace("_", " ") || "Role"} ·{" "}
                    {userProfile?.hub_city || userProfile?.city || "Location"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSettingsOpen}>
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

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <input
                type="text"
                value={settingsData.full_name}
                onChange={(e) => setSettingsData({ ...settingsData, full_name: e.target.value })}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <input
                type="text"
                value={settingsData.hub_city}
                onChange={(e) => setSettingsData({ ...settingsData, hub_city: e.target.value })}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter your location"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleSettingsCancel}>
              Cancel
            </Button>
            <Button onClick={handleSettingsSave}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
