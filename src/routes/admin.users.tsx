import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, UserX, UserCheck, ShieldCheck } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { humanizeRole } from "@/lib/admin-format";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User & Role Administration - DarkOps Admin" },
      {
        name: "description",
        content: "Manage platform users, assign roles, and control account access.",
      },
    ],
  }),
  component: UsersPage,
});

const ROLES = [
  "PLATFORM_ADMIN",
  "EXECUTIVE",
  "OPERATIONS",
  "STORE_MANAGER",
  "CUSTOMER_SUPPORT",
  "CUSTOMER",
];

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  hub_city?: string | null;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useUsers(filters: { search: string; role: string; status: string }) {
  const debouncedSearch = useDebounced(filters.search);
  return useQuery({
    queryKey: ["admin", "users", debouncedSearch, filters.role, filters.status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.role !== "all") params.set("role", filters.role);
      if (filters.status !== "all") params.set("status", filters.status);
      const data = await fetchApi(`/admin/users?${params.toString()}`);
      return (data.data || []) as AdminUser[];
    },
  });
}

type PendingAction =
  | { kind: "role"; user: AdminUser; role: string }
  | { kind: "status"; user: AdminUser; nextActive: boolean }
  | null;

function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pending, setPending] = useState<PendingAction>(null);

  const {
    data: users = [],
    isLoading,
    error,
    refetch,
  } = useUsers({
    search,
    role: roleFilter,
    status: statusFilter,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
  };

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      fetchApi(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("User role updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update role"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetchApi(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.is_active ? "Account reactivated" : "Account deactivated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update account status"),
  });

  const activeCount = useMemo(() => users.filter((u) => u.is_active !== false).length, [users]);

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === "role") {
      roleMutation.mutate({ id: pending.user.id, role: pending.role });
    } else {
      statusMutation.mutate({ id: pending.user.id, is_active: pending.nextActive });
    }
    setPending(null);
  };

  return (
    <>
      <PageHeader
        title="User & Role Administration"
        subtitle="Manage platform access. Assign roles and enable or disable accounts."
      />

      <Panel>
        <PanelHeader
          title="All users"
          subtitle={isLoading ? "Loading…" : `${users.length} shown · ${activeCount} active`}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-56 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {humanizeRole(r)}
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
              <SelectItem value="inactive">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : error ? (
          <ErrorState
            title="Failed to load users"
            hint="The user directory did not respond."
            onRetry={() => refetch()}
          />
        ) : users.length === 0 ? (
          <EmptyState title="No users match" hint="Adjust the search or filters to see users." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Hub</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="row-hover">
                  <Td className="text-[13px] font-medium">{user.full_name || "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{user.email}</Td>
                  <Td>
                    <span className="label-caps text-[10px]">{humanizeRole(user.role)}</span>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{user.hub_city || "—"}</Td>
                  <Td>
                    <Chip tone={user.is_active !== false ? "ok" : "neutral"}>
                      {user.is_active !== false ? "Active" : "Deactivated"}
                    </Chip>
                  </Td>
                  <Td className="num text-xs text-muted-foreground">
                    {formatDate(user.created_at)}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Role <ChevronDown className="ml-1 size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              disabled={r === user.role}
                              onSelect={() => setPending({ kind: "role", user, role: r })}
                            >
                              <ShieldCheck className="mr-2 size-3.5" />
                              {humanizeRole(r)}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={user.is_active !== false ? "text-crit" : "text-ok"}
                            onSelect={() =>
                              setPending({
                                kind: "status",
                                user,
                                nextActive: !(user.is_active !== false),
                              })
                            }
                          >
                            {user.is_active !== false ? (
                              <>
                                <UserX className="mr-2 size-3.5" /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 size-3.5" /> Reactivate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          {pending?.kind === "role" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Change user role?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pending.user.full_name || pending.user.email} will be changed from{" "}
                  <span className="font-medium text-foreground">
                    {humanizeRole(pending.user.role)}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">{humanizeRole(pending.role)}</span>.
                  Their permissions update on their next authenticated request. This action is
                  recorded in the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmPending}>Change role</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : pending?.kind === "status" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending.nextActive ? "Reactivate account?" : "Deactivate account?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pending.nextActive ? (
                    <>
                      {pending.user.full_name || pending.user.email} will regain access to DarkOps.
                    </>
                  ) : (
                    <>
                      {pending.user.full_name || pending.user.email} will be signed out of DarkOps
                      and blocked from authenticating. The account is not deleted and can be
                      reactivated later.
                    </>
                  )}{" "}
                  This action is recorded in the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmPending}
                  className={pending.nextActive ? "" : "bg-crit text-white hover:bg-crit/90"}
                >
                  {pending.nextActive ? "Reactivate" : "Deactivate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
