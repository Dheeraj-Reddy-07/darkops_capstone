import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { AuthContext } from '../../src/types/auth';
import { HTTPError } from '../middleware/errors';

export async function logAudit(params: {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
}) {
  const adminClient = createSupabaseServiceRoleClient();
  const { error } = await adminClient.from('audit_logs').insert({
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    metadata: params.metadata || {},
  });
  if (error) {
    console.error('Failed to log audit event:', error);
  }
}
