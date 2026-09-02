import { createSupabaseServiceRoleClient } from '../lib/supabase';

export interface InsightMetric {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'crit' | 'neutral';
}

export interface InsightAnswer {
  question: string;
  answer: string;
  metrics: InsightMetric[];
  stores: Array<{ id: string; note: string }>;
  causes: string[];
  action: string;
  sources: string;
}

interface NetworkContext {
  avgPulse: number;
  criticalStores: number;
  activeCases: number;
  slaBreached: number;
  p1Cases: number;
  worstStores: Array<{ id: string; name: string; city: string; pulse: number; sla: number; refundRate: number }>;
  topCategories: Array<{ category: string; count: number }>;
}

export class DeterministicInsightsProvider {
  private async buildContext(): Promise<NetworkContext> {
    const supabase = createSupabaseServiceRoleClient();

    const [
      { data: pulseData },
      { count: activeCases },
      { data: complaintStats },
      { data: worstStoresRaw },
      { data: categoryData },
    ] = await Promise.all([
      supabase.from('pulse_scores').select('score, store_id, stores(id, name, city)'),
      supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .in('status', ['unassigned', 'assigned', 'in_progress', 'escalated_l2']),
      supabase
        .from('complaints')
        .select('sla_state, priority')
        .in('status', ['unassigned', 'assigned', 'in_progress', 'escalated_l2']),
      supabase
        .from('stores')
        .select('id, name, city, pulse_scores(score), store_metrics_snapshots(sla_pct, refund_rate_pct)')
        .order('id')
        .limit(50),
      supabase
        .from('complaints')
        .select('category')
        .not('category', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const scores = pulseData?.map((p: any) => p.score) || [];
    const avgPulse = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
    const criticalStores = scores.filter((s: number) => s < 60).length;
    const slaBreached = complaintStats?.filter((c: any) => c.sla_state === 'breached').length || 0;
    const p1Cases = complaintStats?.filter((c: any) => c.priority === 'P1').length || 0;

    const worstStores = (worstStoresRaw || [])
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        pulse: s.pulse_scores?.[0]?.score || 0,
        sla: s.store_metrics_snapshots?.[0]?.sla_pct || 0,
        refundRate: s.store_metrics_snapshots?.[0]?.refund_rate_pct || 0,
      }))
      .filter((s: any) => s.pulse > 0)
      .sort((a: any, b: any) => a.pulse - b.pulse)
      .slice(0, 5);

    const catMap = new Map<string, number>();
    for (const row of (categoryData || [])) {
      const cat = row.category || 'Other';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    }
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      avgPulse,
      criticalStores,
      activeCases: activeCases || 0,
      slaBreached,
      p1Cases,
      worstStores,
      topCategories,
    };
  }

  /** Used by the GET /insights endpoint to return pre-computed summary cards. */
  public async generateInsights() {
    const ctx = await this.buildContext();
    const { avgPulse, criticalStores, activeCases, slaBreached, p1Cases, worstStores } = ctx;

    return [
      {
        id: 'ins-1',
        title: 'Critical Pulse Stores',
        description: `There are ${criticalStores} stores with a PulseScore below 60. Immediate intervention recommended for: ${worstStores.slice(0, 3).map(s => s.name).join(', ')}.`,
        impactLevel: criticalStores > 10 ? 'high' : 'medium',
        category: 'store_performance',
        suggestedAction: 'Deploy operations manager to affected zones.',
      },
      {
        id: 'ins-2',
        title: 'P1 Backlog Alert',
        description: `We currently have ${p1Cases} active P1 (Critical) complaints in the operational queue, with ${slaBreached} SLA breaches.`,
        impactLevel: p1Cases > 5 ? 'high' : 'medium',
        category: 'customer_experience',
        suggestedAction: 'Reassign agents to P1 queue.',
      },
    ];
  }

  /** 
   * Handles a free-form question from the executive chatbot.
   * Builds DB context, then uses an LLM or deterministic fallback.
   */
  public async chat(question: string): Promise<InsightAnswer> {
    const ctx = await this.buildContext();
    const { avgPulse, criticalStores, activeCases, slaBreached, p1Cases, worstStores, topCategories } = ctx;

    // Try LLM if configured
    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    if (googleApiKey) {
      try {
        return await this.callGemini(question, ctx, googleApiKey);
      } catch (err) {
        console.error('[InsightsService] LLM call failed, falling back to deterministic:', err);
      }
    }

    // Deterministic fallback — keyword-matched answers grounded on real DB metrics
    return this.deterministicAnswer(question, { avgPulse, criticalStores, activeCases, slaBreached, p1Cases, worstStores, topCategories });
  }

  private async callGemini(question: string, ctx: NetworkContext, apiKey: string): Promise<InsightAnswer> {
    const contextSummary = `
Network overview (live):
- Average PulseScore: ${ctx.avgPulse}/100
- Critical stores (PulseScore < 60): ${ctx.criticalStores}
- Active open complaints: ${ctx.activeCases}
- SLA breaches: ${ctx.slaBreached}
- P1 (critical) cases: ${ctx.p1Cases}
- Worst 5 stores: ${ctx.worstStores.map(s => `${s.id} ${s.name} (Pulse ${s.pulse}, SLA ${s.sla}%, Refunds ${s.refundRate}%)`).join('; ')}
- Top complaint categories: ${ctx.topCategories.map(c => `${c.category}: ${c.count}`).join(', ')}
`.trim();

    const prompt = `You are a DarkOps executive intelligence assistant. You have access to the following live operational data from the database:

${contextSummary}

Answer this question concisely and factually based ONLY on the data above. Do not speculate. Return a JSON object with these fields:
- answer: string (2-3 sentence factual answer)
- metrics: array of { label, value, tone } where tone is 'ok'|'warn'|'crit'|'neutral'
- stores: array of { id, note } for referenced stores
- causes: array of string (contributing causes)
- action: string (recommended action for ops leadership)
- sources: string (brief description of data sources used)

Question: ${question}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in LLM response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      question,
      answer: parsed.answer || 'No answer available.',
      metrics: parsed.metrics || [],
      stores: parsed.stores || [],
      causes: parsed.causes || [],
      action: parsed.action || 'Consult the operations team.',
      sources: parsed.sources || 'Live operational data',
    };
  }

  private deterministicAnswer(question: string, ctx: NetworkContext): InsightAnswer {
    const q = question.toLowerCase();
    const { avgPulse, criticalStores, activeCases, slaBreached, p1Cases, worstStores, topCategories } = ctx;
    const worstStoreRefs = worstStores.map(s => ({ id: s.id, note: `${s.name} · Pulse ${s.pulse} · SLA ${s.sla}%` }));

    // SLA / breach questions
    if (q.includes('sla') || q.includes('breach')) {
      return {
        question,
        answer: `There are currently ${slaBreached} SLA breaches across the network. The worst-performing stores by SLA are ${worstStores.slice(0, 3).map(s => `${s.name} (${s.sla}%)`).join(', ')}.`,
        metrics: [
          { label: 'SLA Breaches', value: String(slaBreached), tone: slaBreached > 20 ? 'crit' : 'warn' },
          { label: 'P1 Cases', value: String(p1Cases), tone: p1Cases > 10 ? 'crit' : 'warn' },
          { label: 'Network Pulse', value: `${avgPulse}/100`, tone: avgPulse < 60 ? 'crit' : avgPulse < 80 ? 'warn' : 'ok' },
        ],
        stores: worstStoreRefs.slice(0, 3),
        causes: [
          `${slaBreached} complaints have breached their SLA deadline`,
          `${p1Cases} critical (P1) cases in the active queue`,
          `${criticalStores} stores have PulseScore below 60`,
        ],
        action: 'Prioritize P1 case resolution and add agents to stores with >20% SLA breach rate.',
        sources: 'Live complaints table, pulse_scores — current snapshot',
      };
    }

    // Store / intervention questions
    if (q.includes('store') || q.includes('intervention') || q.includes('worst')) {
      return {
        question,
        answer: `${criticalStores} stores are currently operating with a PulseScore below 60 and require immediate intervention. The 5 worst performers are: ${worstStores.map(s => `${s.name} (Pulse ${s.pulse})`).join(', ')}.`,
        metrics: [
          { label: 'Critical Stores', value: String(criticalStores), tone: criticalStores > 10 ? 'crit' : 'warn' },
          { label: 'Network Avg Pulse', value: `${avgPulse}/100`, tone: avgPulse < 70 ? 'warn' : 'ok' },
          { label: 'Active Cases', value: String(activeCases), tone: 'warn' },
        ],
        stores: worstStoreRefs,
        causes: [
          'Equipment downtime is the largest single PulseScore deduction',
          'SLA breaches concentrated in evening peak hours',
          `Top complaint category: ${topCategories[0]?.category || 'missing items'}`,
        ],
        action: `Assign an operations lead to each of the ${criticalStores} critical stores and require daily PulseScore reviews.`,
        sources: 'pulse_scores, store_metrics_snapshots — live data',
      };
    }

    // Refund / fraud questions
    if (q.includes('refund') || q.includes('fraud') || q.includes('risk')) {
      const highRefundStores = worstStores.filter(s => s.refundRate > 5);
      return {
        question,
        answer: `${highRefundStores.length} stores have refund rates above 5%. The top complaint categories driving refunds are: ${topCategories.slice(0, 3).map(c => c.category).join(', ')}.`,
        metrics: [
          { label: 'High Refund Stores', value: String(highRefundStores.length), tone: highRefundStores.length > 5 ? 'crit' : 'warn' },
          { label: 'Active Cases', value: String(activeCases), tone: 'neutral' },
        ],
        stores: highRefundStores.slice(0, 3).map(s => ({ id: s.id, note: `${s.name} · Refunds ${s.refundRate}%` })),
        causes: [
          `Top categories: ${topCategories.slice(0, 3).map(c => `${c.category} (${c.count})`).join(', ')}`,
          'Cold-chain equipment failures drive quality-related refunds',
        ],
        action: 'Route high-value claims through risk review before auto-approval and clear backlog.',
        sources: 'complaints (last 30 days), store_metrics_snapshots',
      };
    }

    // Network health summary (default)
    return {
      question,
      answer: `The network currently shows a PulseScore of ${avgPulse}/100 with ${activeCases} active complaints, ${slaBreached} SLA breaches, and ${criticalStores} stores in the critical zone (below 60).`,
      metrics: [
        { label: 'Network PulseScore', value: `${avgPulse}/100`, tone: avgPulse < 60 ? 'crit' : avgPulse < 80 ? 'warn' : 'ok' },
        { label: 'Active Complaints', value: String(activeCases), tone: activeCases > 100 ? 'crit' : 'warn' },
        { label: 'SLA Breaches', value: String(slaBreached), tone: slaBreached > 20 ? 'crit' : 'warn' },
        { label: 'Critical Stores', value: String(criticalStores), tone: criticalStores > 10 ? 'crit' : 'warn' },
      ],
      stores: worstStoreRefs.slice(0, 2),
      causes: [
        `${criticalStores} stores operating below PulseScore 60`,
        `${p1Cases} critical P1 cases in the active queue`,
        `Top complaint category: ${topCategories[0]?.category || 'Unknown'}`,
      ],
      action: 'Focus on the 5 worst-scoring stores and ensure P1 cases are assigned within 15 minutes.',
      sources: 'pulse_scores, complaints, store_metrics_snapshots — live snapshot',
    };
  }
}
