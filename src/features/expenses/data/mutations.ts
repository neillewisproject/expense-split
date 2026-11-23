let pending: Promise<unknown> = Promise.resolve();

/** Serialize personal writes so validation and the following transaction see the same ledger. */
export function personalMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}
