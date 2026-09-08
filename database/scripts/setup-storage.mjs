import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Test upload capability with service role
const testContent = new TextEncoder().encode("test");
const { data: upd, error: upe } = await supabase.storage
  .from("complaint-attachments")
  .upload("test/test.txt", testContent, { upsert: true });
console.log("upload test:", upd?.path, upe?.message);

// Clean up
if (upd?.path) {
  await supabase.storage.from("complaint-attachments").remove(["test/test.txt"]);
  console.log("cleaned up");
}

// Create a signed upload URL for a test path (this is what the frontend will use)
// Using createSignedUploadUrl so service role generates a URL for the customer to upload directly
const { data: signedUrl, error: sue } = await supabase.storage
  .from("complaint-attachments")
  .createSignedUploadUrl("test-user/test-complaint/test.jpg");
console.log("signed upload URL:", signedUrl?.signedUrl ? "generated OK" : "failed", sue?.message);

console.log("Setup complete — storage bucket is ready for signed upload URLs");
