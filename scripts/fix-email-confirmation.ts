import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function fixEmailConfirmation() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fixing email confirmation for demo users...");

  const demoEmails = [
    "admin@darkops.com",
    "exec@darkops.com", 
    "manager@darkops.com",
    "support@darkops.com",
    "agent.a@darkops.com",
    "agent.b@darkops.com",
    "agent.c@darkops.com",
    "customer@darkops.com",
    "storemanager@darkops.com",
  ];

  for (const email of demoEmails) {
    try {
      // List users to find the user by email
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = listData?.users?.find((u: any) => u.email === email);

      if (existingUser) {
        console.log(`Found user ${email} (ID: ${existingUser.id})`);
        
        // Update user to confirm email
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
        });

        if (updateError) {
          console.error(`Failed to confirm email for ${email}:`, updateError.message);
        } else {
          console.log(`✅ Successfully confirmed email for ${email}`);
        }
      } else {
        console.log(`⚠️  User ${email} not found in auth system`);
      }
    } catch (error) {
      console.error(`Error processing ${email}:`, error);
    }
  }

  console.log("Email confirmation fix complete!");
}

fixEmailConfirmation().catch(console.error);