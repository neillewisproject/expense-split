import { getSupabaseClient } from '@/lib/supabase';

export type SignInLink = { code?: string; error?: string };

function readParams(part: string | undefined, into: Map<string, string>) {
  for (const pair of (part ?? '').split('&')) {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    try {
      into.set(
        decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        decodeURIComponent(rest.join('=').replace(/\+/g, ' ')),
      );
    } catch {
      // Ignore malformed parameters instead of failing the whole link.
    }
  }
}

/**
 * Supabase falls back to the project's Site URL when the requested redirect is not allow-listed,
 * so an OAuth redirect can open any app route. Read its PKCE code or error wherever it lands.
 */
export function readSignInLink(url: string | null | undefined): SignInLink | null {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const path = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
  if (/\/join\//.test(path)) return null;

  const params = new Map<string, string>();
  readParams(queryIndex < 0 ? undefined : beforeHash.slice(queryIndex + 1), params);
  readParams(hashIndex < 0 ? undefined : url.slice(hashIndex + 1), params);

  const error = params.get('error_description') || params.get('error');
  if (error) return { error };
  const code = params.get('code');
  return code ? { code } : null;
}

const exchanges = new Map<string, Promise<void>>();

/** Exchanges each PKCE code once, even if the browser result, deep-link listener and callback route all see it. */
export function completeSignInLink(code: string): Promise<void> {
  let exchange = exchanges.get(code);
  if (!exchange) {
    exchange = getSupabaseClient()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) throw error;
      });
    exchanges.set(code, exchange);
  }
  return exchange;
}
