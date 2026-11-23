import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { getSupabaseClient } from '@/lib/supabase';

const BUCKET = 'group-receipts';
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

async function requireAccount(userId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`Sign in again before sharing receipts: ${error.message}`);
  if (data.user?.id !== userId) throw new Error('Your account changed. Reopen the receipt screen.');
  return client;
}

export async function uploadSharedReceipt(
  userId: string,
  groupId: string,
  expenseId: string,
  uri: string,
): Promise<void> {
  const client = await requireAccount(userId);
  const file = new File(uri);
  if (!file.exists || file.size > 10 * 1024 * 1024)
    throw new Error('Choose an existing receipt photo smaller than 10 MB');
  const extension = file.extension.replace(/^\./, '').toLowerCase();
  const contentType = MIME[extension];
  if (!contentType) throw new Error('Choose a JPEG, PNG, WebP or HEIC receipt');
  const identity = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, uri);
  const path = `${groupId}/${expenseId}/${userId}_${identity}.${extension}`;
  const { error } = await client.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    upsert: true,
    contentType,
  });
  if (error)
    throw new Error(
      `Receipt upload failed: ${error.message}. Sync the expense and apply the private receipt migration first.`,
    );
}

export async function listSharedReceipts(
  userId: string,
  groupId: string,
  expenseId: string,
  offset = 0,
): Promise<{ path: string; url: string }[]> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Choose a valid receipt page');
  const client = await requireAccount(userId);
  const prefix = `${groupId}/${expenseId}`;
  const { data, error } = await client.storage
    .from(BUCKET)
    .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`Could not list private receipts: ${error.message}`);
  const paths = data.filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`);
  if (!paths.length) return [];
  const signed = await client.storage.from(BUCKET).createSignedUrls(paths, 60);
  if (signed.error) throw new Error(`Could not open private receipts: ${signed.error.message}`);
  if (!signed.data) throw new Error('The server returned no receipt links');
  return signed.data.map((entry) => {
    if (entry.error || !entry.signedUrl || !entry.path)
      throw new Error('A private receipt link could not be created. Refresh and try again.');
    return { path: entry.path, url: entry.signedUrl };
  });
}
