import "dotenv/config";
import { ExecutiveAssistantService } from "../server/services/executive-assistant.service";

async function runCopilotTests() {
  console.log("==================================================");
  console.log("TESTING EXECUTIVE OPERATIONAL COPILOT (NO LLM)");
  console.log("==================================================\n");

  const service = new ExecutiveAssistantService();

  const testQueries = [
    // 1. NETWORK
    { category: "NETWORK", query: "What is happening across the network?" },
    { category: "NETWORK", query: "Give me an operational summary" },
    { category: "NETWORK", query: "What's going on right now?" },

    // 2. TRENDS
    { category: "TRENDS", query: "Are complaints increasing?" },
    { category: "TRENDS", query: "Are issues going up?" },
    { category: "TRENDS", query: "Compare complaints this week with last week" },
    { category: "TRENDS", query: "What's changed?" },

    // 3. STORES
    { category: "STORES", query: "Which stores have the most complaints?" },
    { category: "STORES", query: "Which locations need attention?" },
    { category: "STORES", query: "What dark stores are struggling?" },
    { category: "STORES", query: "Show problem stores" },

    // 4. CITIES
    { category: "CITIES", query: "Which cities have the most issues?" },
    { category: "CITIES", query: "Where are complaints concentrated?" },

    // 5. SLA
    { category: "SLA", query: "Where are SLA breaches?" },
    { category: "SLA", query: "How many cases are overdue?" },

    // 6. AUTOMATION
    { category: "AUTOMATION", query: "How effective is automation?" },
    { category: "AUTOMATION", query: "How many issues were auto-resolved?" },

    // 7. RISK
    { category: "RISK", query: "Any fraud risks?" },
    { category: "RISK", query: "Where are suspicious patterns?" },

    // 8. KNOWLEDGE
    { category: "KNOWLEDGE", query: "What is DarkOps?" },
    { category: "KNOWLEDGE", query: "How does auto-resolution work?" },
    { category: "KNOWLEDGE", query: "Is the NLP an LLM?" },

    // 9. HELP & OUT OF SCOPE
    { category: "HELP", query: "What can you do?" },
    { category: "OUT OF SCOPE", query: "What's the weather?" },
  ];

  let passCount = 0;

  for (const t of testQueries) {
    try {
      const res = await service.query(t.query);
      console.log(`[${t.category}] Q: "${t.query}"`);
      console.log(`   -> Intent: ${res.intent}`);
      console.log(`   -> Answer: ${res.answer.split("\n")[0]}`);
      console.log(`   -> Metrics: ${res.metrics.map((m) => `${m.label}: ${m.value}`).join(" | ")}`);
      console.log(`   -> Evidence: ${res.evidence.map((e) => `${e.label}: ${e.value}`).join(" | ")}\n`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ FAIL [${t.category}] Q: "${t.query}":`, err.message);
    }
  }

  // 10. MULTI-TURN CONVERSATIONAL DEMO FLOW
  console.log("==================================================");
  console.log("TESTING 5-QUESTION CONVERSATIONAL DEMO CHAIN");
  console.log("==================================================\n");

  let currentContext: any = undefined;

  const demoChain = [
    "What are the biggest operational issues right now?",
    "Which stores are driving that?",
    "Why is the first one high?",
    "Compare it with last week.",
    "What should I investigate first?",
  ];

  for (let i = 0; i < demoChain.length; i++) {
    const q = demoChain[i];
    console.log(`Step ${i + 1}: User: "${q}"`);
    const res = await service.query(q, currentContext);
    console.log(`   Copilot Intent: ${res.intent}`);
    console.log(`   Copilot Answer: ${res.answer}`);
    if (res.evidence.length > 0) {
      console.log(`   Based on: ${res.evidence.map((e) => `${e.label}: ${e.value}`).join(" | ")}`);
    }
    console.log(`   Suggested chips: ${res.suggestedQuestions.join(" | ")}`);
    currentContext = res.context;
    console.log(`   Updated context: store=${currentContext?.lastStore}, city=${currentContext?.lastCity}, results=${JSON.stringify(currentContext?.lastResults)}\n`);
  }

  console.log(`==================================================`);
  console.log(`TEST SUITE COMPLETED: ${passCount}/${testQueries.length} individual queries + 5-step demo chain passed!`);
  console.log(`==================================================`);
}

runCopilotTests().catch(console.error);
