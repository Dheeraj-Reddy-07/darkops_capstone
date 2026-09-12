import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function checkUserRoles() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Checking user roles in profiles table...");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("email", [
      "agent.a@darkops.com",
      "agent.b@darkops.com",
      "agent.c@darkops.com",
      "support@darkops.com",
    ]);

  if (error) {
    console.error("Error fetching profiles:", error.message);
  } else {
    console.log("User roles:");
    profiles?.forEach((profile: any) => {
      console.log(`  ${profile.email}: ${profile.role} (${profile.full_name})`);
    });
  }

  console.log("\nChecking support_tickets table and assigned agents...");
  const { data: tickets, error: ticketError } = await supabase
    .from("support_tickets")
    .select("ticket_number, assigned_to, title")
    .limit(10);

  if (ticketError) {
    console.error("Error fetching tickets:", ticketError.message);
  } else {
    console.log("Sample tickets:");
    tickets?.forEach((ticket: any) => {
      console.log(
        `  ${ticket.ticket_number}: assigned_to=${ticket.assigned_to}, title=${ticket.title}`,
      );
    });
  }
}

checkUserRoles().catch(console.error);
