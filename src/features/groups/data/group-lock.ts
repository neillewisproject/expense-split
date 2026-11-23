const locks = new Map<string, Promise<unknown>>();

export async function withGroupLock<T>(groupId: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(groupId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  locks.set(groupId, current);
  try {
    return await current;
  } finally {
    if (locks.get(groupId) === current) locks.delete(groupId);
  }
}
