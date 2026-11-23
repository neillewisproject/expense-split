import { getSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/lib/supabase.types';

export type PrivateBackup = { document: Json; revision: number; updated_at: string };

export async function fetchPrivateBackup(userId: string): Promise<PrivateBackup | null> {
  const { data, error } = await getSupabaseClient().rpc('get_personal_backup', {
    p_expected_user_id: userId,
  });
  if (error) throw new Error(`Could not download private backup: ${error.message}`);
  if (!data) throw new Error('The server did not return a backup response');
  return data[0] ?? null;
}

export async function savePrivateBackup(
  userId: string,
  document: Json,
  expectedRevision: number,
): Promise<number> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('A valid backup revision is required');
  if (document === null || typeof document !== 'object' || Array.isArray(document))
    throw new Error('Choose a valid personal backup object');
  const { data, error } = await getSupabaseClient().rpc('save_personal_backup', {
    p_expected_user_id: userId,
    p_document: document,
    p_expected_revision: expectedRevision,
  });
  if (error) throw new Error(`Could not upload private backup: ${error.message}`);
  if (!Number.isSafeInteger(data) || data === null || data < 1)
    throw new Error('The server did not return a valid backup revision');
  return data;
}

export async function deletePrivateBackup(
  userId: string,
  expectedRevision: number,
): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('delete_personal_backup', {
    p_expected_user_id: userId,
    p_expected_revision: expectedRevision,
  });
  if (error) throw new Error(`Could not delete private backup: ${error.message}`);
  if (typeof data !== 'boolean') throw new Error('The server did not return a deletion result');
  return data;
}
