import * as dotenv from 'dotenv';
dotenv.config();

async function testToken() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`
    }
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
}

testToken();
