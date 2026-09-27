import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seed() {
  console.log("Seeding fresh actionable notifications for all DarkOps roles...");

  const { data: users, error: userErr } = await supabase
    .from("profiles")
    .select("id, email, role, full_name");

  if (userErr || !users) {
    console.error("Failed to fetch users:", userErr);
    return;
  }

  const userMap = new Map(users.map((u) => [u.email, u.id]));

  const sampleNotifications = [
    // 1. PLATFORM ADMIN
    {
      email: "admin@darkops.com",
      title: "HMAC Intake Signature Warning",
      meta: "Invalid signature detected on /api/v1/intake/complaints from IP 192.168.1.104",
      link_type: "admin",
      link_ref: "security",
      is_read: false,
    },
    {
      email: "admin@darkops.com",
      title: "Rate Limit Alert",
      meta: "External client reached 95% threshold on /api/v1/search endpoint",
      link_type: "admin",
      link_ref: "security",
      is_read: false,
    },
    {
      email: "admin@darkops.com",
      title: "Security Audit Report Ready",
      meta: "Daily automated posture evaluation completed: Zero critical vulnerabilities",
      link_type: "admin",
      link_ref: "audit",
      is_read: true,
    },

    // 2. EXECUTIVE
    {
      email: "exec@darkops.com",
      title: "PulseScore Critical Alert",
      meta: "Bengaluru South DS (DS-1105) PulseScore dropped to 58.2 due to chiller alarms",
      link_type: "store",
      link_ref: "DS-1105",
      is_read: false,
    },
    {
      email: "exec@darkops.com",
      title: "Network SLA Compliance Alert",
      meta: "North Zone 24h compliance dipped to 93.4% (Target: 98.0%)",
      link_type: "executive",
      link_ref: "",
      is_read: false,
    },
    {
      email: "exec@darkops.com",
      title: "AI Fraud Cluster Flagged",
      meta: "6 refund anomalies detected in Bengaluru Central within 25 minutes",
      link_type: "fraud",
      link_ref: "CS-4111",
      is_read: false,
    },

    // 3. OPERATIONS
    {
      email: "manager@darkops.com",
      title: "P1 SLA Breach Imminent (10m left)",
      meta: "Case CS-4111 is within 10 minutes of breach deadline. Immediate agent action required.",
      link_type: "operations",
      link_ref: "CS-4111",
      is_read: false,
    },
    {
      email: "manager@darkops.com",
      title: "Auto-Resolution Escalation",
      meta: "Complaint CMP-482411 exceeded auto-refund value threshold (₹850 > ₹500). Assigned to queue.",
      link_type: "case",
      link_ref: "CS-4103",
      is_read: false,
    },
    {
      email: "manager@darkops.com",
      title: "Agent Queue Rebalance Recommended",
      meta: "Agent Priya Sharma at capacity (14 active cases)",
      link_type: "operations",
      link_ref: "",
      is_read: true,
    },

    // 4. CUSTOMER SUPPORT (agent.a@darkops.com)
    {
      email: "agent.a@darkops.com",
      title: "New Escalated Ticket Assigned",
      meta: "P1 Escalation: Customer reported missing high-value order ORD-734749",
      link_type: "support_ticket",
      link_ref: "CS-4111",
      is_read: false,
    },
    {
      email: "agent.a@darkops.com",
      title: "VoIP Callback Requested",
      meta: "Customer requested immediate callback with negative sentiment score (15%)",
      link_type: "support_ticket",
      link_ref: "CS-4103",
      is_read: false,
    },
    {
      email: "agent.a@darkops.com",
      title: "Compensation Approved",
      meta: "Manager approved ₹200 wallet compensation for CS-4111",
      link_type: "case",
      link_ref: "CS-4111",
      is_read: false,
    },

    // 5. STORE MANAGER
    {
      email: "storemanager@darkops.com",
      title: "Walk-in Chiller Temp Spike Alert",
      meta: "Bengaluru Central DS Chiller #2 recorded -4.2°C (Threshold: -18°C). Spoilage risk.",
      link_type: "store",
      link_ref: "DS-2076",
      is_read: false,
    },
    {
      email: "storemanager@darkops.com",
      title: "Dispatch Bay Backlog Warning",
      meta: "16 orders awaiting picker assignment in Dispatch Bay 4",
      link_type: "store",
      link_ref: "DS-2076",
      is_read: false,
    },
    {
      email: "storemanager@darkops.com",
      title: "Urgent Work Order Dispatched",
      meta: "Technician dispatched for maintenance of Freezer Unit A",
      link_type: "store",
      link_ref: "DS-2076",
      is_read: true,
    },

    // 6. CUSTOMER
    {
      email: "customer@darkops.com",
      title: "Instant Refund Approved",
      meta: "₹349 has been refunded to your original payment method for Order ORD-964090",
      link_type: "complaint",
      link_ref: "CS-4111",
      is_read: false,
    },
    {
      email: "customer@darkops.com",
      title: "Rider Dispatched",
      meta: "Your delivery partner Rahul is on the way with your order! ETA: 7 mins",
      link_type: "order",
      link_ref: "ORD-964090",
      is_read: false,
    },
    {
      email: "customer@darkops.com",
      title: "Order Delivered",
      meta: "Order ORD-734749 was delivered to your doorstep. Rate your experience!",
      link_type: "order",
      link_ref: "ORD-734749",
      is_read: true,
    },
  ];

  const rowsToInsert = [];
  for (const item of sampleNotifications) {
    const recipient_id = userMap.get(item.email);
    if (!recipient_id) {
      console.warn(`User ${item.email} not found`);
      continue;
    }
    rowsToInsert.push({
      recipient_id,
      title: item.title,
      meta: item.meta,
      link_type: item.link_type,
      link_ref: item.link_ref,
      is_read: item.is_read,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
    });
  }

  const { data, error } = await supabase.from("notifications").insert(rowsToInsert).select();
  if (error) {
    console.error("Error inserting notifications:", error);
  } else {
    console.log(`Successfully seeded ${data.length} notifications!`);
  }
}

seed();
