import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logSecurityEvent } from "../services/audit.service";

let defaultStoresCache: { data: any; meta: any; expiresAt: number } | null = null;

// Roles that may see the entire dark-store network.
const FULL_STORE_ACCESS_ROLES = ["PLATFORM_ADMIN", "EXECUTIVE", "OPERATIONS"];

interface StoreScope {
  all: boolean;
  storeId: string | null;
  role: string;
}

/**
 * Resolve which stores the authenticated user is allowed to see.
 * - Elevated roles get the whole network.
 * - STORE_MANAGER is restricted to their own assigned store (fail closed if none).
 * - Anyone else gets no store access.
 *
 * This is the authoritative data-scope check: controllers use the service-role
 * client (which bypasses RLS), so scoping MUST be enforced here in code.
 */
function getStoreScope(req: Request): StoreScope {
  const auth = (req as any).auth;
  const role = String(auth?.user?.role || "");
  if (FULL_STORE_ACCESS_ROLES.includes(role)) {
    return { all: true, storeId: null, role };
  }
  if (role === "STORE_MANAGER") {
    return { all: false, storeId: auth?.user?.store_id ?? null, role };
  }
  return { all: false, storeId: null, role };
}

/**
 * Returns true when the scope is allowed to touch a specific store id.
 * Logs an IDOR attempt and returns false when a scoped user targets a store
 * that is not theirs.
 */
async function assertStoreAccess(req: Request, storeIdParam: string | string[]): Promise<boolean> {
  const storeId = Array.isArray(storeIdParam) ? storeIdParam[0] : storeIdParam;
  const scope = getStoreScope(req);
  if (scope.all) return true;
  if (scope.storeId && scope.storeId === storeId) return true;

  const auth = (req as any).auth;
  await logSecurityEvent({
    actorId: auth?.user?.id,
    actorRole: scope.role || "UNKNOWN",
    action: "IDOR_ATTEMPT",
    resourceType: "store",
    resourceId: storeId,
    metadata: {
      reason: "cross_store_access_denied",
      assigned_store: scope.storeId,
      requested_store: storeId,
    },
    requestId: (req as any).requestId,
    ip: req.ip,
  });
  return false;
}

export const getStores = async (req: Request, res: Response, next: NextFunction) => {
  const reqStart = Date.now();
  const requestId = (req as any).requestId || "unknown";
  console.log(`[GET_STORES_START] RequestID: ${requestId}`);
  try {
    const query: any = req.query;
    const limit = parseInt(query.limit) || 200;
    const page = parseInt(query.page) || 1;

    // Authoritative data-scope: restrict store managers to their own store.
    const scope = getStoreScope(req);

    // Store managers with no assigned store see nothing (fail closed).
    if (!scope.all && !scope.storeId) {
      return res.status(200).json({ data: [], meta: { total: 0, page, limit } });
    }

    // The shared cache holds the full network; only elevated (all-access) users
    // may read or populate it. Scoped users always run a filtered query.
    const isDefaultQuery =
      scope.all &&
      !query.city &&
      !query.zone &&
      (!query.page || query.page === "1") &&
      (!query.limit || query.limit === "200");

    if (isDefaultQuery && defaultStoresCache && Date.now() < defaultStoresCache.expiresAt) {
      console.log(`[GET_STORES_CACHE_HIT] RequestID: ${requestId} in ${Date.now() - reqStart}ms`);
      return res.status(200).json({
        data: defaultStoresCache.data,
        meta: defaultStoresCache.meta,
      });
    }

    // Use service role to bypass RLS; scoping is enforced in code above/below.
    const adminClient = createSupabaseServiceRoleClient();

    let dbQuery = adminClient.from("stores").select("*", { count: "exact" });

    if (!scope.all) dbQuery = dbQuery.eq("id", scope.storeId);
    if (query.city) dbQuery = dbQuery.eq("city", query.city);
    if (query.zone) dbQuery = dbQuery.eq("zone", query.zone);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to).order("name", { ascending: true });

    // Fetch stores, latest pulse scores, and latest metrics snapshots in parallel
    const [storesRes, pulseRes, metricsRes] = await Promise.all([
      dbQuery,
      adminClient
        .from("pulse_scores")
        .select(
          "store_id, score, equipment_pts, sla_pts, refunds_pts, delivery_pts, picker_pts, inventory_pts, calculated_at",
        )
        .order("calculated_at", { ascending: false })
        .limit(10000),
      adminClient
        .from("store_metrics_snapshots")
        .select("store_id, sla_pct, refund_rate_pct, open_issues, avg_resolution_mins, snapshot_at")
        .order("snapshot_at", { ascending: false })
        .limit(1000),
    ]);
    console.log(`[GET_STORES_QUERIES_DONE] RequestID: ${requestId} in ${Date.now() - reqStart}ms`);

    if (storesRes.error)
      throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${storesRes.error.message}`);

    const stores = storesRes.data || [];
    const count = storesRes.count || stores.length;

    // Map latest pulse score per store
    const pulseMap = new Map<string, any>();
    (pulseRes.data || []).forEach((p: any) => {
      const existing = pulseMap.get(p.store_id);
      if (
        !existing ||
        new Date(p.calculated_at).getTime() > new Date(existing.calculated_at).getTime()
      ) {
        pulseMap.set(p.store_id, p);
      }
    });

    // Map latest metrics snapshot per store
    const metricsMap = new Map<string, any>();
    (metricsRes.data || []).forEach((m: any) => {
      const existing = metricsMap.get(m.store_id);
      if (
        !existing ||
        new Date(m.snapshot_at).getTime() > new Date(existing.snapshot_at).getTime()
      ) {
        metricsMap.set(m.store_id, m);
      }
    });

    const formattedData = stores.map((store: any) => {
      const pulseData = pulseMap.get(store.id);
      const metricsData = metricsMap.get(store.id);
      const storePulse = pulseData?.score ?? (typeof store.pulse === "number" ? store.pulse : 80);

      return {
        ...store,
        metrics: metricsData || null,
        pulse_scores: pulseData || null,
        pulse: storePulse,
      };
    });

    const meta = { total: count, page, limit };
    if (isDefaultQuery) {
      defaultStoresCache = {
        data: formattedData,
        meta,
        expiresAt: Date.now() + 15000,
      };
    }

    console.log(`[GET_STORES_SUCCESS] RequestID: ${requestId} in ${Date.now() - reqStart}ms`);
    res.status(200).json({
      data: formattedData,
      meta,
    });
  } catch (error) {
    console.error(
      `[GET_STORES_ERROR] RequestID: ${(req as any).requestId} in ${Date.now() - reqStart}ms:`,
      error,
    );
    next(error);
  }
};

export const getStoreById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log("[getStoreById] Fetching store:", id);

    // Data-scope: a store manager may only access their own store.
    if (!(await assertStoreAccess(req, id))) {
      throw new HTTPError(403, "FORBIDDEN", "You do not have access to this store.");
    }

    // Use service role to bypass RLS since we already check permissions via RBAC middleware
    const adminClient = createSupabaseServiceRoleClient();
    console.log("[getStoreById] Service role client created");

    const { data, error } = await adminClient
      .from("stores")
      .select(
        `
        *,
        store_metrics_snapshots (*),
        pulse_scores (*)
      `,
      )
      .eq("id", id)
      .single();

    console.log("[getStoreById] Query result:", { error: error?.message, hasData: !!data });

    if (error || !data) {
      console.error("[getStoreById] Error:", error);
      throw new HTTPError(
        404,
        "NOT_FOUND",
        `Store not found: ${error?.message || "Unknown error"}`,
      );
    }

    const rawPulseScore =
      typeof data.pulse === "number"
        ? data.pulse
        : typeof data.pulse?.score === "number"
          ? data.pulse.score
          : 70;

    const pulseScoresList =
      Array.isArray(data.pulse_scores) && data.pulse_scores.length > 0
        ? data.pulse_scores
        : Array.isArray(data.pulseHistory) && data.pulseHistory.length > 0
          ? data.pulseHistory
          : [];

    const latestPulse =
      pulseScoresList.length > 0
        ? [...pulseScoresList].sort(
            (a: any, b: any) =>
              new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime(),
          )[0]
        : {
            score: rawPulseScore,
            calculated_at: new Date().toISOString(),
          };

    const pulseHistory =
      pulseScoresList.length > 0
        ? [...pulseScoresList].sort(
            (a: any, b: any) =>
              new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime(),
          )
        : [
            {
              score: rawPulseScore,
              calculated_at: new Date().toISOString(),
            },
          ];

    const formattedData = {
      ...data,
      metrics: data.store_metrics_snapshots?.[0] || null,
      pulse: latestPulse,
      pulseHistory: pulseHistory,
      store_metrics_snapshots: undefined,
      pulse_scores: undefined,
    };

    console.log("[getStoreById] Returning formatted data for store:", id);
    res.status(200).json(formattedData);
  } catch (error) {
    console.error("[getStoreById] Unexpected error:", error);
    next(error);
  }
};

export const getStorePulse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Data-scope: a store manager may only access their own store's pulse.
    if (!(await assertStoreAccess(req, id))) {
      throw new HTTPError(403, "FORBIDDEN", "You do not have access to this store.");
    }

    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("pulse_scores")
      .select("*")
      .eq("store_id", id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new HTTPError(404, "NOT_FOUND", "Pulse score not found.");
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getStoreWorkOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log("[getStoreWorkOrders] Fetching work orders for store:", id);

    // Data-scope: a store manager may only access their own store's work orders.
    if (!(await assertStoreAccess(req, id))) {
      throw new HTTPError(403, "FORBIDDEN", "You do not have access to this store.");
    }

    // Use service role client to bypass RLS since we already check permissions via RBAC middleware
    const adminClient = createSupabaseServiceRoleClient();

    const { data, error } = await adminClient
      .from("work_orders")
      .select("*")
      .eq("store_id", id)
      .order("created_at", { ascending: false });

    console.log("[getStoreWorkOrders] Query result:", {
      error: error?.message,
      count: data?.length,
    });

    // Return the store's real work orders (empty is a valid state; the UI has a
    // genuine "No open work orders" empty state). Never inject fabricated,
    // wrong-store fallback data.
    res.status(200).json({ data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const createStoreWorkOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { asset_id, asset_name, priority, description } = req.body;
    const auth = (req as any).auth;

    // Data-scope: a store manager may only create work orders for their own store.
    if (!(await assertStoreAccess(req, id))) {
      throw new HTTPError(403, "FORBIDDEN", "You do not have access to this store.");
    }

    console.log("[createStoreWorkOrder] Creating work order for store:", id, "with data:", {
      asset_id,
      asset_name,
      priority,
    });

    // Use service role client to bypass RLS since we already check permissions via RBAC middleware
    const adminClient = createSupabaseServiceRoleClient();

    const { data, error } = await adminClient
      .from("work_orders")
      .insert({
        id: `WO-${Date.now()}`,
        store_id: id,
        asset_id,
        asset_name,
        priority,
        status: "open",
        description,
        assigned_to: auth.user.id,
      })
      .select()
      .single();

    console.log("[createStoreWorkOrder] Insert result:", { error: error?.message, data: data?.id });

    if (error) {
      console.error("[createStoreWorkOrder] Error:", error);
      throw new HTTPError(500, "DATABASE_ERROR", `Failed to create work order: ${error.message}`);
    }

    await adminClient.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_role: auth.user.role,
      action: "work_order.create",
      resource_type: "work_order",
      resource_id: data.id,
      metadata: { store_id: id, asset_id, priority },
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};
