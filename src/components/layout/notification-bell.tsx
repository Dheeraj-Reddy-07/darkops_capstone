import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Flame,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Store,
  ShoppingBag,
  Info,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  Notification,
} from "@/hooks/useNotifications";

/**
 * Parses and formats notification metadata into user-friendly text
 */
function parseNotificationMeta(meta: string | null | undefined): string | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta);
    if (typeof parsed === "object" && parsed !== null) {
      if (parsed.message) return String(parsed.message);
      if (parsed.resolution_type && parsed.complaint_ref) {
        return `${parsed.complaint_ref}: ${parsed.resolution_type} ${parsed.status || "APPROVED"}`;
      }
      if (parsed.reason) return String(parsed.reason);
      return Object.values(parsed).filter(Boolean).join(" • ");
    }
    return String(parsed);
  } catch {
    return meta;
  }
}

/**
 * Returns an appropriate icon and accent color based on notification content
 */
function getNotificationVisuals(title: string, linkType: string) {
  const lower = `${title} ${linkType}`.toLowerCase();

  if (lower.includes("breach") || lower.includes("sla") || lower.includes("temp") || lower.includes("critical")) {
    return {
      icon: Flame,
      color: "text-red-500 bg-red-500/10 border-red-500/20",
    };
  }
  if (lower.includes("fraud") || lower.includes("security") || lower.includes("threat") || lower.includes("hmac")) {
    return {
      icon: ShieldAlert,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    };
  }
  if (lower.includes("refund") || lower.includes("resolved") || lower.includes("approved")) {
    return {
      icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    };
  }
  if (lower.includes("store") || lower.includes("chiller") || lower.includes("equipment")) {
    return {
      icon: Store,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    };
  }
  if (lower.includes("order") || lower.includes("delivery") || lower.includes("rider")) {
    return {
      icon: ShoppingBag,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    };
  }
  return {
    icon: Info,
    color: "text-primary bg-primary/10 border-primary/20",
  };
}

export function NotificationBell({ mode = "staff" }: { mode?: "staff" | "customer" }) {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead();
  const { mutate: deleteNotification } = useDeleteNotification();

  const unreadNum =
    typeof unreadCount === "number"
      ? unreadCount
      : (notifications || []).filter((n) => !n.is_read).length;
  const hasUnread = unreadNum > 0;
  const hasNotifications = Boolean(notifications && notifications.length > 0);

  const go = (n: Notification) => {
    const id = n.link_ref;

    if (mode === "customer") {
      if (n.link_type === "order" && id) {
        navigate({ to: "/customer/orders/$id", params: { id } });
      } else if (n.link_type === "complaint" && id) {
        navigate({ to: "/customer/complaints/$id", params: { id } });
      } else {
        navigate({ to: "/customer" });
      }
      return;
    }

    // Staff routing based on link_type
    switch (n.link_type) {
      case "complaint":
      case "case":
        if (id) navigate({ to: "/cases/$id", params: { id } });
        else navigate({ to: "/operations" });
        break;
      case "support_ticket":
        if (id) navigate({ to: "/support/tickets/$id", params: { id } });
        else navigate({ to: "/support" });
        break;
      case "store":
      case "equipment":
        if (id) navigate({ to: "/dark-stores/$id", params: { id } });
        else navigate({ to: "/dark-stores" });
        break;
      case "fraud":
        if (id) navigate({ to: "/fraud/$id", params: { id } });
        else navigate({ to: "/fraud" });
        break;
      case "operations":
        if (id && (id.startsWith("CS-") || id.startsWith("case-"))) {
          navigate({ to: "/cases/$id", params: { id } });
        } else {
          navigate({ to: "/operations" });
        }
        break;
      case "executive":
      case "pulse":
        navigate({ to: "/executive" });
        break;
      case "admin":
      case "security":
        if (id === "audit") navigate({ to: "/admin/audit-logs" });
        else if (id === "security" || id === "events") navigate({ to: "/admin/security" });
        else navigate({ to: "/admin" });
        break;
      default:
        if (id) {
          navigate({ to: "/cases/$id", params: { id } });
        }
        break;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {hasUnread ? (
            <span className="num absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm animate-in zoom-in-50">
              {unreadNum > 9 ? "9+" : unreadNum}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 sm:w-96 p-0 shadow-lg border-border/80">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-2/70 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Notifications
            </span>
            {hasUnread ? (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-full">
                {unreadNum} unread
              </span>
            ) : null}
          </div>

          {/* Mark All As Read Button (Always visible when notifications exist) */}
          {hasNotifications ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (hasUnread) {
                  markAllAsRead();
                }
              }}
              disabled={!hasUnread || isMarkingAll}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all select-none",
                hasUnread
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer active:scale-95"
                  : "bg-surface-3 text-muted-foreground/60 cursor-default"
              )}
              title={hasUnread ? "Mark all notifications as read" : "All notifications are read"}
            >
              <CheckCheck className="size-3.5" />
              <span>{hasUnread ? "Mark all as read" : "All read"}</span>
            </button>
          ) : null}
        </div>

        {/* Notifications List */}
        {hasNotifications ? (
          <>
            <div className="flex max-h-96 flex-col overflow-y-auto divide-y divide-border/30">
              {notifications.slice(0, 20).map((n) => {
                const visuals = getNotificationVisuals(n.title, n.link_type);
                const Icon = visuals.icon;
                const metaText = parseNotificationMeta(n.meta);
                let relativeTime = "";
                try {
                  if (n.created_at) {
                    relativeTime = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                  }
                } catch {
                  relativeTime = "";
                }

                return (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn(
                      "group relative flex cursor-pointer items-start gap-3 p-3 transition-colors outline-none",
                      !n.is_read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-surface-2"
                    )}
                    onSelect={() => {
                      if (!n.is_read) markAsRead(n.id);
                      go(n);
                    }}
                  >
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border mt-0.5",
                        visuals.color
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>

                    <div className="flex flex-1 flex-col gap-0.5 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "truncate text-xs leading-snug",
                            !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                          )}
                        >
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>

                      {metaText && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {metaText}
                        </p>
                      )}

                      {relativeTime && (
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Clock className="size-2.5" />
                          {relativeTime}
                        </span>
                      )}
                    </div>

                    {/* Individual Delete / Dismiss button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteNotification(n.id);
                      }}
                      title="Dismiss"
                      className="absolute right-2.5 top-3 flex size-5 items-center justify-center rounded-sm text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                );
              })}
            </div>

            {/* Footer with summary and secondary Mark All As Read */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-surface-2/40 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                {hasUnread ? `${unreadNum} unread alert${unreadNum > 1 ? "s" : ""}` : "All alerts caught up"}
              </span>
              {hasUnread && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    markAllAsRead();
                  }}
                  disabled={isMarkingAll}
                  className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bell className="size-6 text-muted-foreground/40 stroke-1" />
            <p className="text-xs">No notifications right now</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
