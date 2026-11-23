import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePersonalStore } from '@/features/accounts/store';

/**
 * Creates any due recurring drafts on mount and whenever the app returns to the foreground.
 * Generation is idempotent, so more than one mounted screen may safely use this hook.
 */
export function useDueRecurring(): string | null {
  const generate = usePersonalStore((state) => state.generateDue);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      generate().then(
        () => setError(null),
        (cause: unknown) =>
          setError(cause instanceof Error ? cause.message : 'Could not check recurring items'),
      );
    };
    check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => listener.remove();
  }, [generate]);
  return error;
}
