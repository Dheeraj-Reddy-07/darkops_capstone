import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const API_URL = 'http://localhost:5000/api/v1';

async function login(email: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'password123'
  });
  if (error || !data.session) throw new Error(`Login failed for ${email}`);
  return data.session.access_token;
}

async function request(endpoint: string, token: string | null, method = 'GET', body?: any) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function runTests() {
  console.log("--- PHASE D & E: AUTH & RBAC VERIFICATION ---");
  
  // Test Unauthorized
  const unauth = await request('/auth/me', null);
  console.log('No token /auth/me ->', unauth.status === 401 ? 'PASS (401)' : `FAIL (${unauth.status})`);

  // Log in as Agent
  const agentToken = await login('agent@darkops.com');
  const agentMe = await request('/auth/me', agentToken);
  console.log('Agent /auth/me ->', agentMe.status === 200 && agentMe.data?.user?.role === 'OPERATIONS_AGENT' ? 'PASS' : `FAIL ${JSON.stringify(agentMe.data)}`);

  // Log in as Exec
  const execToken = await login('exec@darkops.com');
  
  // Log in as Fraud
  const fraudToken = await login('fraud@darkops.com');

  // Log in as Customer
  const custToken = await login('customer@darkops.com');

  // RBAC Tests
  console.log("\n--- RBAC & AUTHORIZATION ---");
  const agentFraud = await request('/fraud', agentToken);
  console.log('Agent /fraud ->', agentFraud.status === 403 ? 'PASS (403)' : `FAIL (${agentFraud.status})`);

  const custStores = await request('/stores', custToken);
  console.log('Customer /stores ->', custStores.status === 403 ? 'PASS (403)' : `FAIL (${custStores.status})`);

  console.log("\n--- PHASE F: API DOMAIN VERIFICATION ---");
  
  // Cases List (Agent)
  const agentCases = await request('/cases?limit=5', agentToken);
  console.log('Agent /cases ->', agentCases.status === 200 && Array.isArray(agentCases.data.data) ? `PASS (${agentCases.data.data.length} cases)` : `FAIL (${agentCases.status}) ${JSON.stringify(agentCases.data)}`);

  // Fraud Queue (Fraud Analyst)
  const fraudCases = await request('/fraud', fraudToken);
  console.log('Fraud /fraud ->', fraudCases.status === 200 ? 'PASS' : `FAIL (${fraudCases.status}) ${JSON.stringify(fraudCases.data)}`);

  // Stores List (Exec)
  const execStores = await request('/stores', execToken);
  console.log('Exec /stores ->', execStores.status === 200 ? 'PASS' : `FAIL (${execStores.status}) ${JSON.stringify(execStores.data)}`);
  
  // Executive Insights
  const execInsights = await request('/executive/insights', execToken);
  console.log('Exec /executive/insights ->', execInsights.status === 200 ? 'PASS' : `FAIL (${execInsights.status})`);

  console.log("\nAll core tests executed.");
}

runTests().catch(console.error);
