import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Calendar, ChevronDown, Search, LogOut, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearch } from "@/hooks/useSearch";
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
    { label: "Customer Support", to: "/fraud" },
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

const RANGES = ["Last 24 hours", "Last 7 days", "Last 30 days", "Quarter to date"];

export function AppShell({ children }: { children: ReactNode }) {
  const [openSearch, setOpenSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearch(searchQuery);
  const [range, setRange] = useState("Last 30 days");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  
  // Fetch current user profile
  const { data: userProfile } = useQuery({
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
  
  const userRole = (userProfile?.role as string) || 'EXECUTIVE';
  const navItems = NAV_BY_ROLE[userRole] || DEFAULT_NAV;
  
  // Roles that should have search access (can search stores, cases, complaints)
  const canSearch = ['PLATFORM_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'STORE_MANAGER'].includes(userRole);
  
  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Clear React Query cache to prevent stale data after logout
    queryClient.clear();
    navigate({ to: '/login' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (item: { label: string; to: string; match?: string }) => {
    const base = "match" in item && item.match ? item.match : item.to;
    return pathname.startsWith(base);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-5">
          <Link to="/executive" className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary/15">
              <span className="size-2.5 rounded-[2px] bg-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
          </Link>
          <span className="label-caps hidden rounded-sm border border-border px-2 py-1 lg:inline-block">
            Operational Intelligence
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
            {canSearch && (
              <>
                <button
                  onClick={() => setOpenSearch(true)}
                  className="hidden h-8 w-64 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-xs text-muted-foreground hover:border-input xl:flex"
                >
                  <Search className="size-3.5" />
                  Search store, case or complaint…
                  <kbd className="num ml-auto rounded-[3px] border border-border px-1 text-[10px]">
                    ⌘K
                  </kbd>
                </button>
                <button
                  onClick={() => setOpenSearch(true)}
                  className="flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground xl:hidden"
                  aria-label="Search"
                >
                  <Search className="size-3.5" />
                </button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  <span className="num absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-muted-foreground">
                    0
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="label-caps">Operational alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  No new alerts
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-xs text-foreground">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {range}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {RANGES.map((r) => (
                  <DropdownMenuItem key={r} onSelect={() => setRange(r)}>
                    {r}
                  </DropdownMenuItem>
                ))}
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

      <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
        <CommandInput 
          placeholder="Search stores, cases, complaints…" 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {searchQuery.length < 2 && <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>}
          {searchQuery.length >= 2 && searchResults && (
            <>
              {(!searchResults.stores?.length && !searchResults.cases?.length && !searchResults.fraud?.length) && (
                <CommandEmpty>No matching operational record found.</CommandEmpty>
              )}
              {searchResults.stores?.length > 0 && (
                <CommandGroup heading="Dark stores">
                  {searchResults.stores.map((s: any) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.id} ${s.name} ${s.city}`}
                      onSelect={() => {
                        if (s.id) {
                          setOpenSearch(false);
                          navigate({ to: "/dark-stores/$id", params: { id: s.id } });
                        }
                      }}
                    >
                      <span className="num text-muted-foreground">{s.id}</span>
                      <span>{s.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{s.city}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {searchResults.cases?.length > 0 && (
                <CommandGroup heading="Cases">
                  {searchResults.cases.map((c: any) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.id} ${c.complaint_id} ${c.summary}`}
                      onSelect={() => {
                        setOpenSearch(false);
                        navigate({ to: "/cases/$id", params: { id: c.id } });
                      }}
                    >
                      <span className="num text-muted-foreground">{c.complaint_id}</span>
                      <span>{c.summary}</span>
                      <span className="num ml-auto text-xs text-muted-foreground">{c.store_id}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {searchResults.fraud?.length > 0 && (
                <CommandGroup heading="Risk queue">
                  {searchResults.fraud.map((f: any) => (
                    <CommandItem
                      key={f.id}
                      value={`${f.id} ${f.customer_name} fraud risk`}
                      onSelect={() => {
                        setOpenSearch(false);
                        navigate({ to: "/fraud/$id", params: { id: f.id } });
                      }}
                    >
                      <span className="num text-muted-foreground">{f.id}</span>
                      <span>{f.customer_name}</span>
                      <span className="num ml-auto text-xs text-muted-foreground">{f.confidence_score}%</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>

      <main className="mx-auto max-w-[1600px] px-5 py-5">{children}</main>
    </div>
  );
}
