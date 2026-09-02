import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { AuthContext } from '../../src/types/auth';
import { logAudit } from './audit.service';
import { HTTPError } from '../middleware/errors';

export async function assignCase(caseId: string, agentId: string, auth: AuthContext) {
  const adminClient = createSupabaseServiceRoleClient();

  const { data: complaint, error: fetchErr } = await adminClient.from('complaints').select('status').eq('id', caseId).single();
  if (fetchErr || !complaint) throw new HTTPError(404, 'NOT_FOUND', 'Case not found');
  
  if (complaint.status === 'resolved') throw new HTTPError(409, 'INVALID_STATE', 'Cannot assign a resolved case');

  const { error: updateErr } = await adminClient.from('complaints').update({
    assigned_agent_id: agentId,
    status: 'assigned',
  }).eq('id', caseId);

  if (updateErr) throw new HTTPError(500, 'UPDATE_FAILED', 'Failed to assign case');

  await logAudit({
    actorId: auth.user.id,
    actorRole: auth.user.role,
    action: 'case.assign',
    resourceType: 'complaint',
    resourceId: caseId,
    metadata: { assignedTo: agentId }
  });
}

export async function escalateCase(caseId: string, note: string, auth: AuthContext) {
  const adminClient = createSupabaseServiceRoleClient();

  const { data: complaint, error: fetchErr } = await adminClient.from('complaints').select('status').eq('id', caseId).single();
  if (fetchErr || !complaint) throw new HTTPError(404, 'NOT_FOUND', 'Case not found');
  
  if (complaint.status === 'resolved') throw new HTTPError(409, 'INVALID_STATE', 'Cannot escalate a resolved case');

  const { error: updateErr } = await adminClient.from('complaints').update({
    status: 'escalated_l2',
  }).eq('id', caseId);

  if (updateErr) throw new HTTPError(500, 'UPDATE_FAILED', 'Failed to escalate case');

  await logAudit({
    actorId: auth.user.id,
    actorRole: auth.user.role,
    action: 'case.escalate',
    resourceType: 'complaint',
    resourceId: caseId,
    metadata: { note }
  });
}

export async function resolveCase(caseId: string, resolution: string, note: string | undefined, auth: AuthContext) {
  const adminClient = createSupabaseServiceRoleClient();

  const { error: updateErr } = await adminClient.from('complaints').update({
    status: 'resolved',
  }).eq('id', caseId);

  if (updateErr) throw new HTTPError(500, 'UPDATE_FAILED', 'Failed to resolve case');

  await logAudit({
    actorId: auth.user.id,
    actorRole: auth.user.role,
    action: 'case.resolve',
    resourceType: 'complaint',
    resourceId: caseId,
    metadata: { resolution, note }
  });
}
