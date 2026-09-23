import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Power, PowerOff, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Panel,
  PanelHeader,
  TableShell,
  Th,
  Td,
  Chip,
  EmptyState,
  ErrorState,
} from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/stores")({
  head: () => ({
    meta: [
      { title: "Store Directory - DarkOps Admin" },
      {
        name: "description",
        content: "Platform registry of dark stores: identity, ownership, and operational status.",
      },
    ],
  }),
  component: StoresPage,
});

interface AdminStore {
  id: string;
  name: string;
  city: string;
  zone: string;
  manager_name: string;
  manager_profile_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useStores(filters: { search: string; city: string; status: string }) {
  const debouncedSearch = useDebounced(filters.search);
  return useQuery({
    queryKey: ["admin", "stores", debouncedSearch, filters.city, filters.status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.city !== "all") params.set("city", filters.city);
      if (filters.status !== "all") params.set("status", filters.status);
      const data = await fetchApi(`/admin/stores?${params.toString()}`);
      return (data.data || []) as AdminStore[];
    },
  });
}

// City options come from an unfiltered snapshot so the dropdown stays stable.
function useCityOptions() {
  return useQuery({
    queryKey: ["admin", "stores", "cities"],
    queryFn: async () => {
      const data = await fetchApi("/admin/stores");
      const cities = new Set<string>();
      (data.data || []).forEach((s: AdminStore) => s.city && cities.add(s.city));
      return Array.from(cities).sort();
    },
  });
}

function StoresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pending, setPending] = useState<AdminStore | null>(null);

  const {
    data: stores = [],
    isLoading,
    error,
    refetch,
  } = useStores({
    search,
    city: cityFilter,
    status: statusFilter,
  });
  const { data: cities = [] } = useCityOptions();

  const statusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetchApi(`/admin/stores/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      toast.success(vars.is_active ? "Store activated" : "Store deactivated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update store"),
  });

  const activeCount = useMemo(() => stores.filter((s) => s.is_active).length, [stores]);

  return (
    <>
      <PageHeader
        title="Store Directory"
        subtitle="Platform registry of dark stores. Manage identity, ownership, and operational status."
      />

      <Panel>
        <PanelHeader
          title="Dark stores"
          subtitle={isLoading ? "Loading…" : `${stores.length} shown · ${activeCount} active`}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, city, or manager"
              className="w-64 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading stores…</div>
        ) : error ? (
          <ErrorState
            title="Failed to load stores"
            hint="The store directory did not respond."
            onRetry={() => refetch()}
          />
        ) : stores.length === 0 ? (
          <EmptyState title="No stores match" hint="Adjust the search or filters to see stores." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>Store ID</Th>
                <Th>City</Th>
                <Th>Zone</Th>
                <Th>Manager</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="row-hover">
                  <Td className="text-[13px] font-medium">{store.name}</Td>
                  <Td className="num text-xs text-muted-foreground">{store.id}</Td>
                  <Td className="text-xs">{store.city}</Td>
                  <Td className="text-xs text-muted-foreground">{store.zone || "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{store.manager_name || "—"}</Td>
                  <Td>
                    <Chip tone={store.is_active ? "ok" : "neutral"}>
                      {store.is_active ? "Active" : "Inactive"}
                    </Chip>
                  </Td>
                  <Td align="right">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-xs ${store.is_active ? "text-crit" : "text-ok"}`}
                      onClick={() => setPending(store)}
                    >
                      {store.is_active ? (
                        <>
                          <PowerOff className="mr-1.5 size-3.5" /> Deactivate
                        </>
                      ) : (
                        <>
                          <Power className="mr-1.5 size-3.5" /> Activate
                        </>
                      )}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <div className="mt-3 flex items-start gap-2 rounded-sm border border-info/25 bg-info/5 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
        <span>
          This is the platform registry for governance — store identity, ownership, and operational
          status. For live operational analytics (PulseScore, SLA, throughput), use the Operations
          and Dark Stores dashboards.
        </span>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending.is_active ? "Deactivate store?" : "Activate store?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pending.is_active ? (
                    <>
                      {pending.name} ({pending.id}) will be marked inactive in the platform
                      registry.
                    </>
                  ) : (
                    <>
                      {pending.name} ({pending.id}) will be marked active in the platform registry.
                    </>
                  )}{" "}
                  This action is recorded in the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={pending.is_active ? "bg-crit text-white hover:bg-crit/90" : ""}
                  onClick={() => {
                    statusMutation.mutate({ id: pending.id, is_active: !pending.is_active });
                    setPending(null);
                  }}
                >
                  {pending.is_active ? "Deactivate" : "Activate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
