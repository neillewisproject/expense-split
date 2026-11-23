import type { User } from '@supabase/supabase-js';

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * First name from the Google/Apple profile. Falls back to the email's local part, which may be a
 * random Apple private-relay address when the user hid their email.
 */
export function firstName(user: User | null): string | undefined {
  const metadata = user?.user_metadata ?? {};
  const name = text(metadata.given_name) ?? text(metadata.full_name) ?? text(metadata.name);
  return name?.split(/\s+/)[0] ?? user?.email?.split('@')[0];
}
