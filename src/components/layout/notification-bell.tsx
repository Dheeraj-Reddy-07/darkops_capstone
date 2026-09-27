import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, useUnreadCount, useMarkAsRead } from "@/hooks/useNotifications";

/**
 * Shared notification bell used by every persona shell. Notifications are RLS-
 * scoped to the signed-in recipient by the API. Link routing is persona-aware:
 * staff open the operational record, customers open their own order/complaint.
 */
export function NotificationBell({ mode = "staff" }: { mode?: "staff" | "customer" }) {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkAsRead();

  const go = (n: any) => {
    const id = n.link_ref;
    if (!id) return;
    if (mode === "customer") {
      if (n.link_type === "order") navigate({ to: "/customer/orders/$id", params: { id } });
      else if (n.link_type === "complaint")
        navigate({ to: "/customer/complaints/$id", params: { id } });
      return;
    }
    if (n.link_type === "complaint") navigate({ to: "/cases/$id", params: { id } });
    else if (n.link_type === "support_ticket")
      navigate({ to: "/support/tickets/$id", params: { id } });
    else if (n.link_type === "store") navigate({ to: "/dark-stores/$id", params: { id } });
    else if (n.link_type === "fraud") navigate({ to: "/fraud/$id", params: { id } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount && unreadCount > 0 ? (
            <span className="num absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="label-caps">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications && notifications.length > 0 ? (
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {notifications.slice(0, 10).map((n: any) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-1 p-3"
                onSelect={() => {
                  if (!n.is_read) markAsRead(n.id);
                  go(n);
                }}
              >
                <div className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      !n.is_read ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-xs",
                      !n.is_read ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {n.title}
                  </span>
                </div>
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
  );
}
