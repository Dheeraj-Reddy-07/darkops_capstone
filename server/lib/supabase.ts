import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { Request, Response } from "express";

export function createSupabaseServerClient(req: Request, res: Response) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder")) {
    return createMockServiceRoleClient();
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(req.headers.cookie || "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.append("Set-Cookie", serializeCookieHeader(name, value, options));
        });
      },
    },
    global: {
      headers: {
        Authorization: req.headers.authorization || "",
      },
    },
  });
}

import { STORES } from "../../src/lib/mock/stores";
import { CASES } from "../../src/lib/mock/cases";
import { FRAUD_CASES } from "../../src/lib/mock/fraud";

const MODULE_INIT_TIME = new Date("2026-09-13T09:00:00Z").getTime();

const MOCK_GROCERY_SKUS = [
  { name: "Aashirvaad Atta 5kg", pricePaise: 24000 },
  { name: "Fortune Sunflower Oil 1L", pricePaise: 16000 },
  { name: "Amul Butter 500g", pricePaise: 27500 },
  { name: "Farm Fresh Eggs ×12", pricePaise: 12000 },
  { name: "Nandini Toned Milk 1L", pricePaise: 6800 },
  { name: "Fresh Paneer 200g", pricePaise: 11000 },
  { name: "Whole Wheat Bread 400g", pricePaise: 4500 },
  { name: "Fresh Curd 400g", pricePaise: 5250 },
  { name: "Robusta Bananas 1kg", pricePaise: 6000 },
  { name: "Kwaliskings Vanilla Ice Cream 1L", pricePaise: 31000 },
  { name: "Safal Frozen Peas 500g", pricePaise: 10000 },
  { name: "Basmati Rice 5kg", pricePaise: 65000 },
];

function generateGroceryOrderItems(seedVal: number, targetTotalPaise: number) {
  const items: Array<{ name: string; quantity: number; unit_price_paise: number }> = [];
  let currentTotal = 0;
  const numTypes = 2 + (Math.abs(seedVal) % 3); // 2, 3, or 4 item types

  for (let i = 0; i < numTypes; i++) {
    const sku = MOCK_GROCERY_SKUS[(Math.abs(seedVal) + i * 3) % MOCK_GROCERY_SKUS.length];
    const qty = 1 + (i === 0 ? Math.abs(seedVal) % 2 : 0);
    items.push({
      name: sku.name,
      quantity: qty,
      unit_price_paise: sku.pricePaise,
    });
    currentTotal += qty * sku.pricePaise;
  }

  // Adjust last item price or add balancing item to ensure exact sum equals targetTotalPaise
  if (items.length > 0) {
    const diff = targetTotalPaise - currentTotal;
    if (diff !== 0) {
      items[items.length - 1].unit_price_paise += Math.floor(
        diff / items[items.length - 1].quantity,
      );
    }
  }

  return items;
}

let cachedMockStoreData: any = null;
let cachedMockCustomerData: any = null;
let cachedMockOrderData: any = null;
let cachedMockComplaintData: any = null;
let cachedMockSupportTicketData: any = null;

function createMockServiceRoleClient() {
  const getMockDataForTable = (table: string) => {
    const now = MODULE_INIT_TIME;

    if (table === "stores") {
      if (cachedMockStoreData) return cachedMockStoreData;
      cachedMockStoreData = STORES.map((s) => {
        const history: any[] = [];
        for (let i = 30; i >= 0; i--) {
          const t = new Date(now - i * 86400000).toISOString();
          const score = Math.max(
            12,
            Math.min(100, s.pulse + Math.round((Math.random() - 0.5) * 4)),
          );
          history.push({
            store_id: s.id,
            score,
            equipment_pts: s.breakdown.equipment,
            sla_pts: s.breakdown.sla,
            refunds_pts: s.breakdown.refunds,
            delivery_pts: s.breakdown.delivery,
            picker_pts: s.breakdown.picker,
            inventory_pts: s.breakdown.inventory,
            calculated_at: t,
          });
        }

        return {
          id: s.id,
          name: s.name,
          city: s.city,
          zone: s.zone,
          manager_name: s.manager,
          pickers_on_shift: s.pickers,
          riders_assigned: s.riders,
          is_active: true,
          pulse: s.pulse,
          store_metrics_snapshots: [
            {
              sla_pct: s.sla,
              refund_rate_pct: s.refundRate,
              equipment_failures_14d: s.equipmentFailures14d,
              inventory_issues: s.inventoryIssues,
              delivery_delays: s.deliveryDelays,
              picker_delay_mins: s.pickerDelayMins,
              avg_resolution_mins: s.avgResolutionMins,
              open_issues: s.openIssues,
            },
          ],
          pulse_scores: history,
        };
      });
      return cachedMockStoreData;
    }
    if (table === "store_metrics_snapshots") {
      return STORES.map((s) => ({
        store_id: s.id,
        sla_pct: s.sla,
        refund_rate_pct: s.refundRate,
        equipment_failures_14d: s.equipmentFailures14d,
        inventory_issues: s.inventoryIssues,
        delivery_delays: s.deliveryDelays,
        picker_delay_mins: s.pickerDelayMins,
        avg_resolution_mins: s.avgResolutionMins,
        open_issues: s.openIssues,
        snapshot_at: new Date(now).toISOString(),
      }));
    }
    if (table === "customers") {
      if (cachedMockCustomerData) return cachedMockCustomerData;
      const userCust = {
        id: "usr-cust-001",
        profile_id: "usr-cust-001",
        email: "customer@darkops.com",
        full_name: "Rajat Sharma",
        phone: "+91 98765 43210",
        address: "Flat 1204, Brigade Enclave, Ring Road, Bengaluru 560103",
        city: "Bengaluru",
        created_at: "2026-01-01T00:00:00.000Z",
      };
      const cu771204 = {
        id: "CU-771204",
        profile_id: "usr-cust-001",
        email: "customer@darkops.com",
        full_name: "Rajat Sharma",
        phone: "+91 98765 43210",
        address: "Flat 1204, Brigade Enclave, Ring Road, Bengaluru 560103",
        city: "Bengaluru",
        created_at: "2026-01-01T00:00:00.000Z",
      };
      const caseCustomers = CASES.map((c) => ({
        id: c.customerId,
        profile_id: c.customerId === "CU-771204" ? "usr-cust-001" : null,
        email:
          c.customerId === "CU-771204"
            ? "customer@darkops.com"
            : `${c.customerId.toLowerCase()}@example.com`,
        full_name: c.customerName,
        phone: "+91 98765 00000",
        city: c.city,
        created_at: "2026-01-01T00:00:00.000Z",
      }));
      cachedMockCustomerData = [userCust, cu771204, ...caseCustomers];
      return cachedMockCustomerData;
    }
    if (table === "orders") {
      if (cachedMockOrderData) return cachedMockOrderData;
      const custOrders = [
        {
          id: "ORD-884213",
          customer_id: "usr-cust-001",
          store_id: "DS-1525",
          status: "out_for_delivery",
          placed_at: "2026-09-13T08:00:00.000Z",
          eta_at: "2026-09-13T09:30:00.000Z",
          delivered_at: null,
          total_amount_paise: 184000,
          item_count: 4,
          items_preview: "Nandini Toned Milk 1L ×2, Farm Fresh Eggs ×12, Amul Butter 500g",
          delivery_partner: "SwiftRiders Express",
          stores: { name: "Bengaluru Ring Road DS", city: "Bengaluru", zone: "East" },
          order_items: [
            { name: "Nandini Toned Milk 1L", quantity: 2, unit_price_paise: 6800 },
            { name: "Farm Fresh Eggs ×12", quantity: 1, unit_price_paise: 12000 },
            { name: "Amul Butter 500g", quantity: 1, unit_price_paise: 158400 },
          ],
        },
        {
          id: "ORD-883940",
          customer_id: "usr-cust-001",
          store_id: "DS-1525",
          status: "delivered", // Order fulfillment is Delivered; refund status is tracked on complaint
          refund_status: "refund_in_progress",
          placed_at: "2026-09-13T02:00:00.000Z",
          eta_at: "2026-09-13T03:00:00.000Z",
          delivered_at: "2026-09-13T02:48:00.000Z",
          total_amount_paise: 62000,
          item_count: 4,
          items_preview:
            "Kwaliskings Vanilla Ice Cream 1L, Safal Frozen Peas 500g, Fresh Curd 400g ×2",
          delivery_partner: "RapidLast Logistics",
          stores: { name: "Bengaluru Ring Road DS", city: "Bengaluru", zone: "East" },
          order_items: [
            { name: "Kwaliskings Vanilla Ice Cream 1L", quantity: 1, unit_price_paise: 31000 },
            { name: "Safal Frozen Peas 500g", quantity: 1, unit_price_paise: 10500 },
            { name: "Fresh Curd 400g", quantity: 2, unit_price_paise: 10250 },
          ],
        },
        {
          id: "ORD-882117",
          customer_id: "usr-cust-001",
          store_id: "DS-1105",
          status: "delivered",
          placed_at: "2026-09-11T09:00:00.000Z",
          delivered_at: "2026-09-11T09:30:00.000Z",
          total_amount_paise: 247000,
          item_count: 4,
          items_preview: "Aashirvaad Atta 5kg, Basmati Rice 5kg, Fortune Sunflower Oil 1L ×2",
          delivery_partner: "MetroFleet Express",
          stores: { name: "Bengaluru South DS", city: "Bengaluru", zone: "South" },
          order_items: [
            { name: "Aashirvaad Atta 5kg", quantity: 1, unit_price_paise: 24000 },
            { name: "Basmati Rice 5kg", quantity: 1, unit_price_paise: 191000 },
            { name: "Fortune Sunflower Oil 1L", quantity: 2, unit_price_paise: 16000 },
          ],
        },
        {
          id: "ORD-879654",
          customer_id: "usr-cust-001",
          store_id: "DS-1525",
          status: "delivered",
          placed_at: "2026-09-09T09:00:00.000Z",
          delivered_at: "2026-09-09T09:25:00.000Z",
          total_amount_paise: 91000,
          item_count: 4,
          items_preview: "Robusta Bananas 1kg, Fresh Paneer 200g ×2, Whole Wheat Bread 400g",
          delivery_partner: "GreenWheels Eco",
          stores: { name: "Bengaluru Ring Road DS", city: "Bengaluru", zone: "East" },
          order_items: [
            { name: "Robusta Bananas 1kg", quantity: 1, unit_price_paise: 6000 },
            { name: "Fresh Paneer 200g", quantity: 2, unit_price_paise: 40250 },
            { name: "Whole Wheat Bread 400g", quantity: 1, unit_price_paise: 4500 },
          ],
        },
      ];

      const FIXED_BASE_EPOCH = new Date("2026-09-10T12:00:00.000Z").getTime();
      const caseOrders = CASES.map((c, idx) => {
        const orderValPaise = (c.orderValue || 500) * 100;
        const groceryItems = generateGroceryOrderItems(idx + 1, orderValPaise);
        const totalItemsCount = groceryItems.reduce((acc, i) => acc + i.quantity, 0);
        const previewText = groceryItems
          .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
          .join(", ");

        return {
          id: c.orderId,
          customer_id:
            c.customerId === "CU-771204" || c.id === "CS-4101" ? "usr-cust-001" : c.customerId,
          store_id: c.storeId,
          status: "delivered",
          placed_at: new Date(FIXED_BASE_EPOCH - (c.ageMins + 120) * 60000).toISOString(),
          delivered_at: new Date(FIXED_BASE_EPOCH - c.ageMins * 60000).toISOString(),
          total_amount_paise: orderValPaise,
          item_count: totalItemsCount,
          items_preview: previewText,
          delivery_partner: c.partner || "SwiftRiders Express",
          stores: { name: c.storeName, city: c.city, zone: "Central" },
          order_items: groceryItems,
        };
      });

      cachedMockOrderData = [...custOrders, ...caseOrders];
      return cachedMockOrderData;
    }
    if (table === "complaints") {
      if (cachedMockComplaintData) return cachedMockComplaintData;
      const customCustomerComplaint = {
        id: "CMP-482137",
        complaint_ref: "CMP-482137",
        customer_id: "usr-cust-001",
        order_id: "ORD-883940",
        store_id: "DS-1525",
        summary: "Melted frozen goods on arrival",
        detail:
          "Ice cream and frozen peas arrived thawed. Store freezer FRZ-08 logged 3h of downtime in the pick window.",
        category: "quality_issue",
        type: "refund",
        priority: "P2",
        status: "in_progress",
        settlement_status: "pending",
        sla_state: "at_risk",
        assigned_agent_id: "usr-mgr-001",
        order_value_paise: 62000,
        refund_amount_paise: 41000,
        created_at: "2026-09-13T02:00:00.000Z",
        updated_at: "2026-09-13T05:00:00.000Z",
        sla_due_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        stores: { name: "Bengaluru Ring Road DS", city: "Bengaluru" },
        orders: { item_count: 4, total_amount_paise: 62000 },
        complaint_attachments: [
          {
            id: "att-1",
            filename: "frozen_melted_1.jpg",
            file_type: "image/jpeg",
            uploaded_at: "2026-09-13T02:30:00.000Z",
          },
        ],
        complaint_status_history: [
          {
            from_status: null,
            to_status: "unassigned",
            changed_at: "2026-09-13T02:00:00.000Z",
            note: "Complaint submitted by customer",
          },
          {
            from_status: "unassigned",
            to_status: "assigned",
            changed_at: "2026-09-13T03:00:00.000Z",
            note: "Assigned to Ops Manager",
          },
          {
            from_status: "assigned",
            to_status: "in_progress",
            changed_at: "2026-09-13T05:00:00.000Z",
            note: "Investigating store freezer FRZ-08 logs",
          },
        ],
      };

      const FIXED_BASE_EPOCH = new Date("2026-09-10T12:00:00.000Z").getTime();
      const casesComplaints = CASES.map((c, idx) => {
        let status = "unassigned";
        if (c.status === "Assigned") status = "assigned";
        if (c.status === "In progress") status = "in_progress";
        if (c.status === "Awaiting customer") status = "awaiting_customer";
        if (c.status === "Escalated - L2") status = "escalated_l2";
        if (c.status === "Resolved") status = "resolved";

        // Settlement status field check: A complaint cannot be marked resolved if refund settlement is pending
        const settlementStatus =
          c.resolution?.toLowerCase().includes("pending") ||
          c.detail?.toLowerCase().includes("pending") ||
          c.detail?.includes("Gateway")
            ? "pending"
            : c.type === "Refund"
              ? "settled"
              : "n/a";

        if (status === "resolved" && settlementStatus === "pending") {
          status = "in_progress";
        }

        let slaState = "on_track";
        if (c.sla === "breached") slaState = "breached";
        else if (c.sla === "at-risk") slaState = "at_risk";

        const isUserCust =
          c.customerId === "CU-771204" || c.id === "CS-4101" || idx === 0 || idx === 12;
        const custId = isUserCust ? "usr-cust-001" : c.customerId;

        const formattedRef = c.complaintId
          ? c.complaintId.replace(/^(CS|REF)-/, "CMP-")
          : `CMP-${482000 + idx}`;

        const agentList = [
          "AG-101 (Priya Sharma)",
          "AG-102 (Rohan Mehta)",
          "AG-103 (Sneha Patel)",
          "AG-104 (Amit Kumar)",
          "AG-105 (Kavita Rao)",
        ];
        const assignedAgent = status !== "unassigned" ? agentList[idx % agentList.length] : null;

        return {
          id: c.id,
          complaint_ref: formattedRef.startsWith("CMP-") ? formattedRef : `CMP-${formattedRef}`,
          customer_id: custId,
          order_id: c.orderId,
          store_id: c.storeId,
          summary: c.summary,
          detail: c.detail,
          category:
            c.category === "Late delivery"
              ? "late_delivery"
              : c.category === "Quality issue"
                ? "quality_issue"
                : c.category === "Missing item"
                  ? "missing_item"
                  : c.category === "Wrong item"
                    ? "wrong_item"
                    : c.category === "Damaged item"
                      ? "damaged_item"
                      : c.category === "Payment issue"
                        ? "payment_issue"
                        : "other",
          type: c.type === "Refund" ? "refund" : "operational_investigation",
          priority: c.priority,
          status,
          settlement_status: settlementStatus,
          sla_state: slaState,
          assigned_agent_id: assignedAgent,
          order_value_paise: c.orderValue * 100,
          refund_amount_paise: c.refundAmount * 100,
          created_at: new Date(FIXED_BASE_EPOCH - (c.ageMins || 60) * 60000).toISOString(),
          customers: { full_name: isUserCust ? "Rajat Sharma" : c.customerName },
          stores: { name: c.storeName, city: c.city },
          orders: {
            item_count: Math.max(1, Math.floor(c.orderValue / 100)),
            total_amount_paise: c.orderValue * 100,
          },
          complaint_status_history: [
            {
              from_status: null,
              to_status: status,
              changed_at: new Date(FIXED_BASE_EPOCH - (c.ageMins || 60) * 60000).toISOString(),
              note: "Complaint logged in support system",
            },
          ],
        };
      });

      cachedMockComplaintData = [customCustomerComplaint, ...casesComplaints];
      return cachedMockComplaintData;
    }
    if (table === "support_tickets") {
      if (cachedMockSupportTicketData) return cachedMockSupportTicketData;
      const now = Date.now();
      const pSupp = {
        id: "usr-supp-001",
        full_name: "Ananya Krishnan",
        email: "support@darkops.com",
      };
      const pAgentA = {
        id: "usr-agent-a",
        full_name: "Priya Sharma",
        email: "agent.a@darkops.com",
      };
      const pAgentB = { id: "usr-agent-b", full_name: "Rohan Mehta", email: "agent.b@darkops.com" };
      const pAgentC = { id: "usr-agent-c", full_name: "Kavya Nair", email: "agent.c@darkops.com" };
      const pAgentD = { id: "usr-agent-d", full_name: "Arjun Singh", email: "agent.d@darkops.com" };
      const pAgentE = { id: "usr-agent-e", full_name: "Meera Iyer", email: "agent.e@darkops.com" };
      const pAgentF = {
        id: "usr-agent-f",
        full_name: "Deepak Verma",
        email: "agent.f@darkops.com",
      };
      const pAgentG = {
        id: "usr-agent-g",
        full_name: "Sonia Kapoor",
        email: "agent.g@darkops.com",
      };
      const cBy = { id: "usr-cust-001", full_name: "Rajat Sharma", email: "customer@darkops.com" };

      // Helper to build a ticket record concisely
      function mkt(
        id: string,
        num: string,
        title: string,
        status: string,
        priority: string,
        queue: string,
        assignedTo: string | null,
        profile: any,
        slaOffsetMin: number | null,
        createdHrsAgo: number | null,
        resolvedBy: string | null,
        notes: string | null,
        cmpId: string | null,
        orderId: string | null,
        storeId: string | null,
        category: string | null,
      ) {
        const isResolved = status === "resolved" || status === "closed";
        return {
          id,
          ticket_number: "TKT-" + num,
          complaint_id: cmpId || "CMP-" + num,
          title,
          status,
          priority,
          queue,
          assigned_to: assignedTo || null,
          assigned_to_profile: profile || null,
          created_by: "usr-cust-001",
          created_by_profile: cBy,
          resolved_by: resolvedBy || null,
          resolved_by_profile: resolvedBy ? profile : null,
          sla_deadline: isResolved
            ? null
            : new Date(now + (slaOffsetMin || 60) * 60000).toISOString(),
          created_at: new Date(now - (createdHrsAgo || 1) * 3600000).toISOString(),
          updated_at: new Date(now - Math.max(0, (createdHrsAgo || 1) - 1) * 3600000).toISOString(),
          resolution_notes: notes || null,
          resolution_time_minutes: resolvedBy ? Math.round((createdHrsAgo || 24) * 60 * 0.6) : null,
          complaints: {
            id: cmpId || "CMP-" + num,
            complaint_ref: "CMP-" + num,
            summary: title,
            category: category || "other",
            order_id: orderId || "ORD-884213",
            customer_id: "usr-cust-001",
            store_id: storeId || "DS-1525",
            order_value_paise: 90000,
            refund_amount_paise: priority === "P1" ? 45000 : priority === "P2" ? 25000 : 10000,
          },
        };
      }

      const tickets = [
        // ─── Support Lead: Ananya Krishnan (usr-supp-001) ─────────────────────────
        mkt(
          "tkt-482137",
          "482137",
          "Melted frozen goods on arrival – ORD-883940",
          "in_progress",
          "P2",
          "refunds",
          "usr-supp-001",
          pSupp,
          15,
          6,
          null,
          null,
          "CMP-482137",
          "ORD-883940",
          "DS-1525",
          "quality_issue",
        ),
        mkt(
          "tkt-482140",
          "482140",
          "Urgent: Wrong item batch delivered – ORD-882117",
          "open",
          "P1",
          "refunds",
          "usr-supp-001",
          pSupp,
          -10,
          4,
          null,
          null,
          "CMP-482140",
          "ORD-882117",
          "DS-1105",
          "wrong_item",
        ),
        mkt(
          "tkt-482141",
          "482141",
          "Double charge dispute on UPI transaction",
          "awaiting_customer",
          "P3",
          "general",
          "usr-supp-001",
          pSupp,
          120,
          8,
          null,
          null,
          "CMP-482141",
          "ORD-879654",
          "DS-1525",
          "payment_issue",
        ),
        mkt(
          "tkt-482142",
          "482142",
          "Packaging damage refund verified",
          "resolved",
          "P3",
          "operational",
          "usr-supp-001",
          pSupp,
          null,
          26,
          "usr-supp-001",
          "Refund processed to original payment method",
          "CMP-482142",
          "ORD-879654",
          "DS-1525",
          "damaged_item",
        ),
        mkt(
          "tkt-482143",
          "482143",
          "Escalated: Cold chain breach complaint from DS-1105",
          "escalated",
          "P1",
          "escalated",
          "usr-supp-001",
          pSupp,
          -5,
          2,
          null,
          null,
          "CMP-482143",
          "ORD-882117",
          "DS-1105",
          "quality_issue",
        ),
        mkt(
          "tkt-482144",
          "482144",
          "SLA review: Payment gateway timeout batch",
          "in_progress",
          "P2",
          "general",
          "usr-supp-001",
          pSupp,
          45,
          3,
          null,
          null,
          "CMP-482144",
          "ORD-883940",
          "DS-1525",
          "payment_issue",
        ),

        // ─── Agent A: Priya Sharma (usr-agent-a) ──────────────────────────────────
        mkt(
          "tkt-482150",
          "482150",
          "Spoiled produce in order ORD-884213",
          "in_progress",
          "P1",
          "refunds",
          "usr-agent-a",
          pAgentA,
          10,
          1,
          null,
          null,
          "CMP-482150",
          "ORD-884213",
          "DS-1525",
          "quality_issue",
        ),
        mkt(
          "tkt-482151",
          "482151",
          "Missing high-value items – Basmati Rice 5kg",
          "open",
          "P2",
          "refunds",
          "usr-agent-a",
          pAgentA,
          -25,
          3,
          null,
          null,
          "CMP-482151",
          "ORD-882117",
          "DS-1105",
          "missing_item",
        ),
        mkt(
          "tkt-482152",
          "482152",
          "Customer requesting partial refund for damaged box",
          "awaiting_customer",
          "P3",
          "general",
          "usr-agent-a",
          pAgentA,
          180,
          5,
          null,
          null,
          "CMP-482152",
          "ORD-879654",
          "DS-1525",
          "damaged_item",
        ),
        mkt(
          "tkt-482153",
          "482153",
          "Refund approved for missing organic eggs",
          "resolved",
          "P2",
          "refunds",
          "usr-agent-a",
          pAgentA,
          null,
          28,
          "usr-agent-a",
          "Refund of ₹120 approved and credited to wallet",
          "CMP-482153",
          "ORD-884213",
          "DS-1525",
          "missing_item",
        ),
        mkt(
          "tkt-482154",
          "482154",
          "Chilled dairy temperature breach alert DS-1525",
          "in_progress",
          "P1",
          "operational",
          "usr-agent-a",
          pAgentA,
          15,
          1,
          null,
          null,
          "CMP-482154",
          "ORD-883940",
          "DS-1525",
          "quality_issue",
        ),
        mkt(
          "tkt-482155",
          "482155",
          "Wrong item: Nandini Toned Milk vs Whole Milk",
          "open",
          "P3",
          "refunds",
          "usr-agent-a",
          pAgentA,
          240,
          4,
          null,
          null,
          "CMP-482155",
          "ORD-884213",
          "DS-1525",
          "wrong_item",
        ),
        mkt(
          "tkt-482156",
          "482156",
          "Duplicate UPI charge verification pending",
          "awaiting_customer",
          "P4",
          "general",
          "usr-agent-a",
          pAgentA,
          360,
          7,
          null,
          null,
          "CMP-482156",
          "ORD-882117",
          "DS-1105",
          "payment_issue",
        ),
        mkt(
          "tkt-482157",
          "482157",
          "Damaged packaging refund credited and closed",
          "closed",
          "P3",
          "operational",
          "usr-agent-a",
          pAgentA,
          null,
          52,
          "usr-agent-a",
          "Case closed after customer confirmed bank receipt",
          "CMP-482157",
          "ORD-879654",
          "DS-1525",
          "damaged_item",
        ),

        // ─── Agent B: Rohan Mehta (usr-agent-b) ───────────────────────────────────
        mkt(
          "tkt-482160",
          "482160",
          "Delayed express delivery >45 mins – CS-4101",
          "in_progress",
          "P2",
          "delivery",
          "usr-agent-b",
          pAgentB,
          20,
          2,
          null,
          null,
          "CMP-482160",
          "ORD-883940",
          "DS-1525",
          "late_delivery",
        ),
        mkt(
          "tkt-482161",
          "482161",
          "Urgent: Rider conduct complaint – DS-1525",
          "open",
          "P1",
          "escalated",
          "usr-agent-b",
          pAgentB,
          -15,
          5,
          null,
          null,
          "CMP-482161",
          "ORD-884213",
          "DS-1525",
          "other",
        ),
        mkt(
          "tkt-482162",
          "482162",
          "Address pin offset causing rider misdirection",
          "open",
          "P3",
          "operational",
          "usr-agent-b",
          pAgentB,
          240,
          6,
          null,
          null,
          "CMP-482162",
          "ORD-882117",
          "DS-1105",
          "other",
        ),
        mkt(
          "tkt-482163",
          "482163",
          "Rider reassigned and delivery completed",
          "resolved",
          "P3",
          "delivery",
          "usr-agent-b",
          pAgentB,
          null,
          30,
          "usr-agent-b",
          "Replacement rider dispatched and order delivered",
          "CMP-482163",
          "ORD-879654",
          "DS-1525",
          "late_delivery",
        ),
        mkt(
          "tkt-482164",
          "482164",
          "Cold chain container seal broken on arrival",
          "in_progress",
          "P1",
          "delivery",
          "usr-agent-b",
          pAgentB,
          -5,
          2,
          null,
          null,
          "CMP-482164",
          "ORD-883940",
          "DS-1525",
          "quality_issue",
        ),
        mkt(
          "tkt-482165",
          "482165",
          "Rider unreachable during last-mile window",
          "open",
          "P2",
          "delivery",
          "usr-agent-b",
          pAgentB,
          12,
          3,
          null,
          null,
          "CMP-482165",
          "ORD-884213",
          "DS-1525",
          "late_delivery",
        ),
        mkt(
          "tkt-482166",
          "482166",
          "Delivery address change requested mid-transit",
          "awaiting_customer",
          "P3",
          "general",
          "usr-agent-b",
          pAgentB,
          300,
          9,
          null,
          null,
          "CMP-482166",
          "ORD-882117",
          "DS-1105",
          "other",
        ),
        mkt(
          "tkt-482167",
          "482167",
          "Delivery delay compensation coupon issued",
          "resolved",
          "P3",
          "delivery",
          "usr-agent-b",
          pAgentB,
          null,
          34,
          "usr-agent-b",
          "₹100 wallet promo code issued for SLA delay",
          "CMP-482167",
          "ORD-879654",
          "DS-1525",
          "late_delivery",
        ),

        // ─── Agent C: Kavya Nair (usr-agent-c) ────────────────────────────────────
        mkt(
          "tkt-482200",
          "482200",
          "Rotten vegetables delivered – DS-1462",
          "open",
          "P1",
          "refunds",
          "usr-agent-c",
          pAgentC,
          8,
          1,
          null,
          null,
          "CMP-482200",
          "ORD-884213",
          "DS-1462",
          "quality_issue",
        ),
        mkt(
          "tkt-482201",
          "482201",
          "Wrong brand cooking oil delivered",
          "in_progress",
          "P2",
          "refunds",
          "usr-agent-c",
          pAgentC,
          60,
          3,
          null,
          null,
          "CMP-482201",
          "ORD-882117",
          "DS-1462",
          "wrong_item",
        ),
        mkt(
          "tkt-482202",
          "482202",
          "Missing paneer in order ORD-879654",
          "open",
          "P3",
          "refunds",
          "usr-agent-c",
          pAgentC,
          200,
          4,
          null,
          null,
          "CMP-482202",
          "ORD-879654",
          "DS-1525",
          "missing_item",
        ),
        mkt(
          "tkt-482203",
          "482203",
          "Customer refund for expired dairy products",
          "resolved",
          "P2",
          "refunds",
          "usr-agent-c",
          pAgentC,
          null,
          48,
          "usr-agent-c",
          "Full refund ₹55 processed to original UPI",
          "CMP-482203",
          "ORD-883940",
          "DS-1462",
          "quality_issue",
        ),
        mkt(
          "tkt-482204",
          "482204",
          "High-priority escalation – pesticide trace alert",
          "escalated",
          "P1",
          "escalated",
          "usr-agent-c",
          pAgentC,
          -30,
          2,
          null,
          null,
          "CMP-482204",
          "ORD-884213",
          "DS-1462",
          "quality_issue",
        ),
        mkt(
          "tkt-482205",
          "482205",
          "Store pickup miscommunication – order cancelled",
          "awaiting_customer",
          "P3",
          "general",
          "usr-agent-c",
          pAgentC,
          150,
          7,
          null,
          null,
          "CMP-482205",
          "ORD-882117",
          "DS-1462",
          "other",
        ),
        mkt(
          "tkt-482206",
          "482206",
          "Incorrect MRP charged for imported items",
          "in_progress",
          "P2",
          "general",
          "usr-agent-c",
          pAgentC,
          40,
          2,
          null,
          null,
          "CMP-482206",
          "ORD-879654",
          "DS-1525",
          "payment_issue",
        ),

        // ─── Agent D: Arjun Singh (usr-agent-d) ───────────────────────────────────
        mkt(
          "tkt-482210",
          "482210",
          "Broken eggs and leaking bottles – DS-1105",
          "open",
          "P2",
          "refunds",
          "usr-agent-d",
          pAgentD,
          90,
          3,
          null,
          null,
          "CMP-482210",
          "ORD-884213",
          "DS-1105",
          "damaged_item",
        ),
        mkt(
          "tkt-482211",
          "482211",
          "Bulk reorder refused – store OOS flag",
          "in_progress",
          "P3",
          "reorders",
          "usr-agent-d",
          pAgentD,
          300,
          6,
          null,
          null,
          "CMP-482211",
          "ORD-882117",
          "DS-1105",
          "other",
        ),
        mkt(
          "tkt-482212",
          "482212",
          "UPI double-debit – payment gateway failure",
          "open",
          "P1",
          "general",
          "usr-agent-d",
          pAgentD,
          -20,
          4,
          null,
          null,
          "CMP-482212",
          "ORD-879654",
          "DS-1525",
          "payment_issue",
        ),
        mkt(
          "tkt-482213",
          "482213",
          "Return pickup not scheduled by logistics",
          "escalated",
          "P2",
          "escalated",
          "usr-agent-d",
          pAgentD,
          -45,
          3,
          null,
          null,
          "CMP-482213",
          "ORD-883940",
          "DS-1105",
          "other",
        ),
        mkt(
          "tkt-482214",
          "482214",
          "Substituted product delivered without consent",
          "awaiting_customer",
          "P3",
          "refunds",
          "usr-agent-d",
          pAgentD,
          180,
          8,
          null,
          null,
          "CMP-482214",
          "ORD-884213",
          "DS-1462",
          "wrong_item",
        ),
        mkt(
          "tkt-482215",
          "482215",
          "Weight mismatch in atta pack – 4.8kg vs 5kg",
          "resolved",
          "P3",
          "refunds",
          "usr-agent-d",
          pAgentD,
          null,
          36,
          "usr-agent-d",
          "Partial credit ₹120 issued; store notified",
          "CMP-482215",
          "ORD-882117",
          "DS-1105",
          "quality_issue",
        ),
        mkt(
          "tkt-482216",
          "482216",
          "Temperature excursion on cold delivery run",
          "in_progress",
          "P1",
          "delivery",
          "usr-agent-d",
          pAgentD,
          25,
          2,
          null,
          null,
          "CMP-482216",
          "ORD-883940",
          "DS-1525",
          "quality_issue",
        ),

        // ─── Agent E: Meera Iyer (usr-agent-e) ────────────────────────────────────
        mkt(
          "tkt-482220",
          "482220",
          "Rider refused to carry heavy grocery bags",
          "open",
          "P2",
          "escalated",
          "usr-agent-e",
          pAgentE,
          120,
          4,
          null,
          null,
          "CMP-482220",
          "ORD-884213",
          "DS-1462",
          "other",
        ),
        mkt(
          "tkt-482221",
          "482221",
          "Incorrect expiry date on packed paneer",
          "in_progress",
          "P1",
          "refunds",
          "usr-agent-e",
          pAgentE,
          -10,
          1,
          null,
          null,
          "CMP-482221",
          "ORD-882117",
          "DS-1525",
          "quality_issue",
        ),
        mkt(
          "tkt-482222",
          "482222",
          "Order partially delivered – 2 items missing",
          "open",
          "P2",
          "refunds",
          "usr-agent-e",
          pAgentE,
          75,
          3,
          null,
          null,
          "CMP-482222",
          "ORD-879654",
          "DS-1105",
          "missing_item",
        ),
        mkt(
          "tkt-482223",
          "482223",
          "Coupon code not applied at checkout",
          "awaiting_customer",
          "P4",
          "general",
          "usr-agent-e",
          pAgentE,
          480,
          10,
          null,
          null,
          "CMP-482223",
          "ORD-883940",
          "DS-1462",
          "payment_issue",
        ),
        mkt(
          "tkt-482224",
          "482224",
          "Refund for cancelled order still pending",
          "in_progress",
          "P2",
          "refunds",
          "usr-agent-e",
          pAgentE,
          30,
          2,
          null,
          null,
          "CMP-482224",
          "ORD-884213",
          "DS-1525",
          "payment_issue",
        ),
        mkt(
          "tkt-482225",
          "482225",
          "Wrong cereal brand exchange completed",
          "resolved",
          "P3",
          "refunds",
          "usr-agent-e",
          pAgentE,
          null,
          44,
          "usr-agent-e",
          "Replacement dispatched from DS-1525 same day",
          "CMP-482225",
          "ORD-882117",
          "DS-1525",
          "wrong_item",
        ),

        // ─── Agent F: Deepak Verma (usr-agent-f) ──────────────────────────────────
        mkt(
          "tkt-482230",
          "482230",
          "Express slot not honoured – 30min delivery breach",
          "open",
          "P1",
          "delivery",
          "usr-agent-f",
          pAgentF,
          -8,
          2,
          null,
          null,
          "CMP-482230",
          "ORD-883940",
          "DS-1462",
          "late_delivery",
        ),
        mkt(
          "tkt-482231",
          "482231",
          "Packaging seal broken on ghee jar",
          "in_progress",
          "P2",
          "refunds",
          "usr-agent-f",
          pAgentF,
          55,
          3,
          null,
          null,
          "CMP-482231",
          "ORD-884213",
          "DS-1525",
          "damaged_item",
        ),
        mkt(
          "tkt-482232",
          "482232",
          "Customer claims partial order – 3 of 7 items missing",
          "open",
          "P2",
          "refunds",
          "usr-agent-f",
          pAgentF,
          110,
          5,
          null,
          null,
          "CMP-482232",
          "ORD-882117",
          "DS-1105",
          "missing_item",
        ),
        mkt(
          "tkt-482233",
          "482233",
          "Reorder approval pending for bulk dal purchase",
          "awaiting_customer",
          "P3",
          "reorders",
          "usr-agent-f",
          pAgentF,
          240,
          7,
          null,
          null,
          "CMP-482233",
          "ORD-879654",
          "DS-1462",
          "other",
        ),
        mkt(
          "tkt-482234",
          "482234",
          "Fraudulent charge investigation – card not present",
          "escalated",
          "P1",
          "escalated",
          "usr-agent-f",
          pAgentF,
          -60,
          5,
          null,
          null,
          "CMP-482234",
          "ORD-883940",
          "DS-1525",
          "payment_issue",
        ),
        mkt(
          "tkt-482235",
          "482235",
          "Late delivery coupon issued + apology sent",
          "resolved",
          "P3",
          "delivery",
          "usr-agent-f",
          pAgentF,
          null,
          52,
          "usr-agent-f",
          "₹75 coupon issued, complaint logged with logistics",
          "CMP-482235",
          "ORD-884213",
          "DS-1462",
          "late_delivery",
        ),

        // ─── Agent G: Sonia Kapoor (usr-agent-g) ──────────────────────────────────
        mkt(
          "tkt-482240",
          "482240",
          "Oil leakage damaged entire grocery bag",
          "open",
          "P2",
          "refunds",
          "usr-agent-g",
          pAgentG,
          65,
          2,
          null,
          null,
          "CMP-482240",
          "ORD-882117",
          "DS-1525",
          "damaged_item",
        ),
        mkt(
          "tkt-482241",
          "482241",
          "Customer allergic reaction – mislabelled product",
          "escalated",
          "P1",
          "escalated",
          "usr-agent-g",
          pAgentG,
          -90,
          3,
          null,
          null,
          "CMP-482241",
          "ORD-884213",
          "DS-1462",
          "quality_issue",
        ),
        mkt(
          "tkt-482242",
          "482242",
          "App showed delivered but order never arrived",
          "in_progress",
          "P1",
          "delivery",
          "usr-agent-g",
          pAgentG,
          -15,
          2,
          null,
          null,
          "CMP-482242",
          "ORD-879654",
          "DS-1105",
          "late_delivery",
        ),
        mkt(
          "tkt-482243",
          "482243",
          "Store charged premium pricing outside slot window",
          "awaiting_customer",
          "P3",
          "general",
          "usr-agent-g",
          pAgentG,
          200,
          6,
          null,
          null,
          "CMP-482243",
          "ORD-883940",
          "DS-1462",
          "payment_issue",
        ),
        mkt(
          "tkt-482244",
          "482244",
          "Replacement sent for broken yoghurt jars",
          "resolved",
          "P2",
          "refunds",
          "usr-agent-g",
          pAgentG,
          null,
          38,
          "usr-agent-g",
          "3 yoghurt jars replaced same day from DS-1525",
          "CMP-482244",
          "ORD-884213",
          "DS-1525",
          "damaged_item",
        ),
        mkt(
          "tkt-482245",
          "482245",
          "Batch recall: Paneer lot PC-2609 – affected stores",
          "open",
          "P2",
          "operational",
          "usr-agent-g",
          pAgentG,
          180,
          4,
          null,
          null,
          "CMP-482245",
          "ORD-882117",
          "DS-1105",
          "quality_issue",
        ),

        // ─── Unassigned Pool ──────────────────────────────────────────────────────
        mkt(
          "tkt-482170",
          "482170",
          "Missing butter pack – ORD-879654",
          "open",
          "P1",
          "general",
          null,
          null,
          12,
          1,
          null,
          null,
          "CMP-482170",
          "ORD-879654",
          "DS-1525",
          "missing_item",
        ),
        mkt(
          "tkt-482171",
          "482171",
          "Chiller temperature alert – DS-1105",
          "open",
          "P2",
          "operational",
          null,
          null,
          150,
          3,
          null,
          null,
          "CMP-482171",
          "ORD-882117",
          "DS-1105",
          "quality_issue",
        ),
        mkt(
          "tkt-482172",
          "482172",
          "Payment refund status inquiry",
          "open",
          "P3",
          "refunds",
          null,
          null,
          300,
          5,
          null,
          null,
          "CMP-482172",
          "ORD-883940",
          "DS-1525",
          "payment_issue",
        ),
        mkt(
          "tkt-482173",
          "482173",
          "New complaint: Bread delivered stale",
          "open",
          "P2",
          "refunds",
          null,
          null,
          60,
          1,
          null,
          null,
          "CMP-482173",
          "ORD-884213",
          "DS-1462",
          "quality_issue",
        ),
        mkt(
          "tkt-482174",
          "482174",
          "Delivery GPS mismatch – needs investigation",
          "open",
          "P3",
          "delivery",
          null,
          null,
          240,
          2,
          null,
          null,
          "CMP-482174",
          "ORD-879654",
          "DS-1105",
          "late_delivery",
        ),
      ];

      cachedMockSupportTicketData = tickets;
      return cachedMockSupportTicketData;
    }
    if (table === "ticket_activity") {
      return [
        {
          id: "act-1",
          ticket_id: "tkt-482137",
          event_type: "created",
          created_at: "2026-09-13T02:00:00.000Z",
          payload: { complaint_id: "CMP-482137", order_id: "ORD-883940" },
          actor: { id: "usr-supp-001", full_name: "Customer Support" },
        },
        {
          id: "act-2",
          ticket_id: "tkt-482150",
          event_type: "created",
          created_at: "2026-09-13T08:00:00.000Z",
          payload: { complaint_id: "CMP-482150", order_id: "ORD-884213" },
          actor: { id: "usr-agent-a", full_name: "Priya Sharma" },
        },
        {
          id: "act-3",
          ticket_id: "tkt-482160",
          event_type: "created",
          created_at: "2026-09-13T08:15:00.000Z",
          payload: { complaint_id: "CMP-482160", order_id: "ORD-883940" },
          actor: { id: "usr-agent-b", full_name: "Rohan Mehta" },
        },
      ];
    }
    if (table === "complaint_attachments") {
      return [
        {
          id: "att-1",
          complaint_id: "CMP-482137",
          filename: "frozen_melted_1.jpg",
          file_type: "image/jpeg",
          file_size_bytes: 245000,
          storage_path: "usr-cust-001/frozen_melted_1.jpg",
          uploaded_at: "2026-09-13T02:30:00.000Z",
        },
      ];
    }
    if (table === "complaint_status_history") {
      return [
        {
          id: "csh-1",
          complaint_id: "CMP-482137",
          from_status: null,
          to_status: "unassigned",
          changed_at: "2026-09-13T02:00:00.000Z",
          note: "Complaint submitted by customer",
        },
        {
          id: "csh-2",
          complaint_id: "CMP-482137",
          from_status: "unassigned",
          to_status: "assigned",
          changed_at: "2026-09-13T03:00:00.000Z",
          note: "Assigned to Ops Manager",
        },
        {
          id: "csh-3",
          complaint_id: "CMP-482137",
          from_status: "assigned",
          to_status: "in_progress",
          changed_at: "2026-09-13T05:00:00.000Z",
          note: "Investigating store freezer FRZ-08 logs",
        },
      ];
    }
    if (table === "pulse_scores") {
      const rows: any[] = [];
      const now = Date.now();
      STORES.forEach((s) => {
        for (let i = 30; i >= 0; i--) {
          const t = new Date(now - i * 86400000).toISOString();
          const score = Math.max(
            12,
            Math.min(100, s.pulse + Math.round((Math.random() - 0.5) * 4)),
          );
          rows.push({
            store_id: s.id,
            score,
            equipment_pts: s.breakdown.equipment,
            sla_pts: s.breakdown.sla,
            refunds_pts: s.breakdown.refunds,
            delivery_pts: s.breakdown.delivery,
            picker_pts: s.breakdown.picker,
            inventory_pts: s.breakdown.inventory,
            calculated_at: t,
          });
        }
      });
      return rows;
    }
    if (table === "work_orders") {
      const woRows: any[] = [];
      STORES.forEach((s) => {
        const count = s.status === "critical" ? 4 : s.status === "at-risk" ? 2 : 1;
        for (let i = 0; i < count; i++) {
          woRows.push({
            id: `WO-${s.id}-${i + 1}`,
            store_id: s.id,
            asset_id: `EQ-${s.id}-${i + 1}`,
            asset_name: ["Walk-in Freezer", "Chiller Unit", "POS Scanner", "Conveyor Belt"][i % 4],
            priority: s.status === "critical" ? "P1" : s.status === "at-risk" ? "P2" : "P3",
            status: "open",
            description: "Maintenance required for operational health stability.",
            created_at: new Date(Date.now() - (i + 1) * 3600000 * 4).toISOString(),
          });
        }
      });
      return woRows;
    }
    if (table === "fraud_reviews") {
      return FRAUD_CASES.map((f: any) => ({
        id: f.id,
        complaint_id: f.caseId,
        customer_id: f.customerId,
        confidence_score: f.confidence,
        reason: f.reason || "High velocity risk",
        decision: "pending_review",
      }));
    }
    if (table === "alerts") {
      return STORES.filter((s) => s.pulse < 60).map((s, idx) => ({
        id: `ALT-${s.id}-${idx + 1}`,
        store_id: s.id,
        title: "Critical Pulse Score",
        detail: `Store ${s.name} health critical (Pulse: ${s.pulse})`,
        severity: "crit",
        is_resolved: false,
      }));
    }
    if (table === "notifications") {
      return [
        {
          id: "notif-1",
          recipient_id: "usr-exec-001",
          title: "DarkOps Platform Active",
          meta: JSON.stringify({ info: "System operational" }),
          link_type: "store",
          link_ref: "DS-1462",
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ];
    }
    if (table === "profiles") {
      return [
        {
          id: "usr-admin-001",
          email: "admin@darkops.com",
          full_name: "System Admin",
          role: "PLATFORM_ADMIN",
          is_active: true,
        },
        {
          id: "usr-exec-001",
          email: "exec@darkops.com",
          full_name: "Network Exec",
          role: "EXECUTIVE",
          is_active: true,
        },
        {
          id: "usr-mgr-001",
          email: "manager@darkops.com",
          full_name: "Ops Manager",
          role: "OPERATIONS",
          is_active: true,
        },
        {
          id: "usr-supp-001",
          email: "support@darkops.com",
          full_name: "Ananya Krishnan",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-a",
          email: "agent.a@darkops.com",
          full_name: "Priya Sharma",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-b",
          email: "agent.b@darkops.com",
          full_name: "Rohan Mehta",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-c",
          email: "agent.c@darkops.com",
          full_name: "Kavya Nair",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-d",
          email: "agent.d@darkops.com",
          full_name: "Arjun Singh",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-e",
          email: "agent.e@darkops.com",
          full_name: "Meera Iyer",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-f",
          email: "agent.f@darkops.com",
          full_name: "Deepak Verma",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-agent-g",
          email: "agent.g@darkops.com",
          full_name: "Sonia Kapoor",
          role: "CUSTOMER_SUPPORT",
          is_active: true,
        },
        {
          id: "usr-sm-001",
          email: "storemanager@darkops.com",
          full_name: "Store Manager",
          role: "STORE_MANAGER",
          is_active: true,
          store_id: "DS-1462",
        },
        {
          id: "usr-cust-001",
          email: "customer@darkops.com",
          full_name: "Rajat Sharma",
          role: "CUSTOMER",
          is_active: true,
        },
      ];
    }
    return [];
  };

  function createQueryBuilder(table: string) {
    const dataset: any[] = getMockDataForTable(table);
    let countHeadOnly = false;
    let singleMode = false;
    let maybeSingleMode = false;
    let limitVal: number | null = null;
    let rangeFrom: number | null = null;
    let rangeTo: number | null = null;
    let sortField: string | null = null;
    let sortAscending = true;

    const filterFns: Array<(item: any) => boolean> = [];

    const builder: any = {
      select(fields?: string, options?: any) {
        if (options?.head) countHeadOnly = true;
        return builder;
      },
      eq(field: string, value: any) {
        filterFns.push((item) => {
          if (item[field] !== undefined && item[field] !== null) {
            return String(item[field]) === String(value);
          }
          return false;
        });
        return builder;
      },
      neq(field: string, value: any) {
        filterFns.push((item) => {
          if (item[field] !== undefined && item[field] !== null) {
            return String(item[field]) !== String(value);
          }
          return true;
        });
        return builder;
      },
      gt(field: string, value: any) {
        filterFns.push((item) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return val > value;
        });
        return builder;
      },
      gte(field: string, value: any) {
        filterFns.push((item) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return val >= value;
        });
        return builder;
      },
      lt(field: string, value: any) {
        filterFns.push((item) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return val < value;
        });
        return builder;
      },
      lte(field: string, value: any) {
        filterFns.push((item) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return val <= value;
        });
        return builder;
      },
      in(field: string, values: any[]) {
        const strVals = (values || []).map(String);
        filterFns.push((item) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return strVals.includes(String(val));
        });
        return builder;
      },
      is(field: string, value: any) {
        filterFns.push((item) => {
          return item[field] === value;
        });
        return builder;
      },
      not(field: string, operator: string, value: any) {
        filterFns.push((item) => {
          const val = item[field];
          if (operator === "is") {
            return val !== value;
          }
          if (operator === "in") {
            let strVals: string[] = [];
            if (Array.isArray(value)) {
              strVals = value.map(String);
            } else if (typeof value === "string") {
              strVals = value
                .replace(/^\(|\)$/g, "")
                .split(",")
                .map((v) => v.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
            }
            if (val === undefined || val === null) return true;
            return !strVals.includes(String(val));
          }
          if (operator === "eq") {
            return String(val) !== String(value);
          }
          return true;
        });
        return builder;
      },
      ilike(field: string, pattern: string) {
        const cleanPattern = (pattern || "").replace(/%/g, "").toLowerCase();
        filterFns.push((item) => {
          const val = item[field];
          if (!val) return false;
          return String(val).toLowerCase().includes(cleanPattern);
        });
        return builder;
      },
      like(field: string, pattern: string) {
        const cleanPattern = (pattern || "").replace(/%/g, "");
        filterFns.push((item) => {
          const val = item[field];
          if (!val) return false;
          return String(val).includes(cleanPattern);
        });
        return builder;
      },
      or(condition: string) {
        return builder;
      },
      order(field: string, options?: { ascending?: boolean }) {
        if (field) {
          sortField = field;
          sortAscending = options?.ascending !== false;
        }
        return builder;
      },
      limit(n: number) {
        limitVal = n;
        return builder;
      },
      range(from: number, to: number) {
        rangeFrom = from;
        rangeTo = to;
        return builder;
      },
      single() {
        singleMode = true;
        return builder;
      },
      maybeSingle() {
        maybeSingleMode = true;
        return builder;
      },
      insert(rows: any) {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        rowArray.forEach((r) => {
          if (!r.id) r.id = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          if (!r.created_at) r.created_at = new Date().toISOString();
        });
        dataset.push(...rowArray);
        const resultData = Array.isArray(rows) ? rowArray : rowArray[0];

        const chain: any = {
          select() {
            return chain;
          },
          single() {
            return chain;
          },
          maybeSingle() {
            return chain;
          },
          then(resolve: any) {
            resolve({ data: resultData, error: null });
          },
        };
        return chain;
      },
      upsert(rows: any) {
        return builder.insert(rows);
      },
      update(values: any) {
        // Store update payload separately - do NOT push into filterFns.
        // filterFns are filter predicates only; mutations are applied after filtering.
        const updatePayload = { ...values, updated_at: new Date().toISOString() };

        const chain: any = {
          select() {
            return chain;
          },
          eq(f: string, v: any) {
            // This .eq() is chained after .update() - add it to outer builder's filters
            filterFns.push((item: any) => {
              if (item[f] !== undefined && item[f] !== null) {
                return String(item[f]) === String(v);
              }
              // Allow null to match null for null-equality checks
              return item[f] === v;
            });
            return chain;
          },
          not(f: string, op: string, v: any) {
            filterFns.push((item: any) => {
              const val = item[f];
              if (op === "is") return val !== v;
              if (op === "eq") return String(val) !== String(v);
              return true;
            });
            return chain;
          },
          is(f: string, v: any) {
            filterFns.push((item: any) => item[f] === v);
            return chain;
          },
          single() {
            return chain;
          },
          maybeSingle() {
            return chain;
          },
          then(resolve: any) {
            // Apply only filter predicates (no mutations), then apply updatePayload to matched rows only
            const filtered = dataset.filter((item: any) => filterFns.every((fn: any) => fn(item)));
            filtered.forEach((item: any) => Object.assign(item, updatePayload));
            resolve({ data: filtered[0] || null, error: null });
          },
        };
        return chain;
      },
      delete() {
        return builder;
      },
      then(resolve: any) {
        let filtered = dataset.filter((item) => filterFns.every((fn) => fn(item)));

        if (sortField) {
          const f = sortField;
          const asc = sortAscending;
          filtered.sort((a: any, b: any) => {
            if (a[f] < b[f]) return asc ? -1 : 1;
            if (a[f] > b[f]) return asc ? 1 : -1;
            return 0;
          });
        }

        if (limitVal !== null) {
          filtered = filtered.slice(0, limitVal);
        } else if (rangeFrom !== null && rangeTo !== null) {
          filtered = filtered.slice(rangeFrom, rangeTo + 1);
        }

        if (countHeadOnly) {
          resolve({ count: filtered.length, data: null, error: null });
        } else if (singleMode || maybeSingleMode) {
          resolve({ data: filtered[0] || null, error: null });
        } else {
          resolve({ data: filtered, count: filtered.length, error: null });
        }
      },
    };

    return builder;
  }

  return {
    from(table: string) {
      return createQueryBuilder(table);
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUploadUrl(path: string) {
            return {
              data: {
                signedUrl: `https://mock-storage.darkops.com/upload/${bucket}/${path}?token=mock`,
                path,
              },
              error: null,
            };
          },
        };
      },
    },
    auth: {
      admin: {
        async listUsers() {
          return { data: { users: [] }, error: null };
        },
        async createUser() {
          return { data: { user: null }, error: null };
        },
      },
      async getUser(token?: string) {
        if (!token) return { data: { user: null }, error: new Error("Auth session missing") };
        return { data: { user: { id: "mock-user", email: "mock@darkops.com" } }, error: null };
      },
    },
  } as any;
}

export function createSupabaseServiceRoleClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes("placeholder")) {
    return createMockServiceRoleClient();
  }

  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
