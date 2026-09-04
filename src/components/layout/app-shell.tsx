import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Calendar, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

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

// Role-based navigation configuration
const NAV_BY_ROLE: Record<string, Array<{ label: string; to: string; match?: string }>> = {
  PLATFORM_ADMIN: [
    { label: "Overview", to: "/admin" },
    { label: "Users", to: "/admin/users" },
    { label: "Stores", to: "/dark-stores" },
    { label: "Audit", to: "/admin/audit" },
  ],
  EXECUTIVE: [
    { label: "Executive", to: "/executive" },
    { label: "Dark Stores", to: "/dark-stores" },
  ],
  OPERATIONS: [
    { label: "Operations", to: "/operations" },
    { label: "Dark Stores", to: "/dark-stores" },
  ],
  CUSTOMER_SUPPORT: [
    { label: "My Queue", to: "/support" },
  ],
  STORE_MANAGER: [
    { label: "My Store", to: "/dark-stores" },
  ],
  CUSTOMER: [], // Customer uses separate shell
};

const DEFAULT_NAV = [
  { label: "Executive", to: "/executive" },
  { label: "Operations", to: "/operations" },
  { label: "Cases", to: "/operations", match: "/cases" },
  { label: "Dark Store", to: "/dark-stores" },
  { label: "Fraud", to: "/fraud" },
] as const;



export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // Fetch current user profile
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return profile as any; // Type assertion for now
    },
  });
  
  // Fetch notifications
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkAsRead();
  
  const userRole = (userProfile?.role as string);
  const navItems = userRole ? (NAV_BY_ROLE[userRole] || DEFAULT_NAV) : (isLoading ? [] : DEFAULT_NAV);
  
  const defaultPath = userRole === 'OPERATIONS' ? '/operations' : 
                      userRole === 'PLATFORM_ADMIN' ? '/admin' : 
                      userRole === 'CUSTOMER_SUPPORT' ? '/support' :
                      userRole === 'STORE_MANAGER' ? '/dark-stores' : '/executive';
  
  // Workspace label shown in the navbar (role-contextual)
  const workspaceLabel = userRole === 'CUSTOMER_SUPPORT' ? 'Support' :
                         userRole === 'OPERATIONS' ? 'Operations' :
                         userRole === 'STORE_MANAGER' ? 'Store Ops' :
                         userRole === 'EXECUTIVE' ? 'Executive' :
                         userRole === 'PLATFORM_ADMIN' ? 'Admin' :
                         'Operational Intelligence';
  
  // Roles that should have search access (can search stores, cases, complaints)
  const canSearch = ['PLATFORM_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'STORE_MANAGER', 'CUSTOMER_SUPPORT'].includes(userRole || 'EXECUTIVE');
  
  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Clear React Query cache to prevent stale data after logout
    queryClient.clear();
    navigate({ to: '/login' });
  };


  const isActive = (item: { label: string; to: string; match?: string }) => {
    const base = "match" in item && item.match ? item.match : item.to;
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


            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  {unreadCount && unreadCount > 0 ? (
                    <span className="num absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
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
                          if (notification.link_type === 'complaint') {
                            navigate({ to: '/cases/$id', params: { id: notification.link_ref } });
                          } else if (notification.link_type === 'support_ticket') {
                            navigate({ to: '/support/tickets/$id', params: { id: notification.link_ref } });
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className={cn(
                            "size-2 rounded-full shrink-0",
                            !notification.is_read ? "bg-primary" : "bg-transparent"
                          )} />
                          <span className={cn(
                            "text-xs truncate", 
                            !notification.is_read ? "font-medium" : "text-muted-foreground"
                          )}>
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
                  {userProfile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-[13px]">{userProfile?.full_name || 'User'}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {userProfile?.role?.replace('_', ' ') || 'Role'} · {userProfile?.hub_city || userProfile?.city || 'Location'}
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
