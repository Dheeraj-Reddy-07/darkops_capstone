import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, TableShell, Th, Td, StatusBadge, EmptyState } from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User management — DarkOps Admin" },
      { name: "description", content: "Manage platform users, view roles, and update access permissions." },
    ],
  }),
  component: UsersPage,
});

const ROLES = [
  "ADMIN",
  "EXECUTIVE",
  "OPERATIONS_MANAGER",
  "OPERATIONS_AGENT",
  "FRAUD_ANALYST",
  "STORE_MANAGER",
  "DELIVERY_PARTNER",
  "CUSTOMER",
];

function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const data = await fetchApi("/admin/users");
      return (data.data || []) as Array<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
        hub_city?: string;
      }>;
    },
  });
}

function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return await fetchApi(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User role updated");
    },
    onError: (err: any) => {
      toast.error(`Failed to update role: ${err.message || "Unknown error"}`);
    },
  });
}

function UsersPage() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const { data: users = [], isLoading, error } = useUsers();
  const updateRole = useUpdateRole();

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="User management"
        subtitle="All registered profiles. Update roles or deactivate accounts."
      />

      <Panel>
        <PanelHeader
          title="All users"
          subtitle={`${users.length} registered profiles`}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or ID"
              className="w-60 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {roleFilter === "all" ? "All roles" : roleFilter.replace("_", " ")}
                <ChevronDown className="ml-1 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setRoleFilter("all")}>All roles</DropdownMenuItem>
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onSelect={() => setRoleFilter(r)}>
                  {r.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-crit">Failed to load users.</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No users match" hint="Clear filters to see all users." />
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
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="row-hover">
                  <Td className="text-[13px] font-medium">{user.full_name || "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{user.email}</Td>
                  <Td>
                    <span className="label-caps text-[10px]">{user.role?.replace(/_/g, " ")}</span>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{user.hub_city || "—"}</Td>
                  <Td>
                    <StatusBadge status={user.is_active !== false ? "Active" : "Inactive"} />
                  </Td>
                  <Td className="num text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("en-IN")}
                  </Td>
                  <Td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Change role <ChevronDown className="ml-1 size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {ROLES.map((r) => (
                          <DropdownMenuItem
                            key={r}
                            disabled={r === user.role}
                            onSelect={() => updateRole.mutate({ id: user.id, role: r })}
                          >
                            {r.replace(/_/g, " ")}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
