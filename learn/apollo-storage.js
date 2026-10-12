/** Optimistic protection for Apollo's two local records; never merges or rebases
 * a stale in-memory flight. Keep one guard for the lifetime of the page. */
const APOLLO_KEYS = new Set(['grove.apollo.flight-school.v1', 'grove.apollo.flight.v1']);

export function guardedStorage(storage, onConflict = () => {}) {
  const baselines = new Map();
  let conflicted = false;
  const conflictError = () => Object.assign(new Error('Apollo progress changed in another tab. Reload the latest progress before continuing.'), { code: 'APOLLO_STORAGE_CONFLICT' });
  const noticeConflict = key => {
    if (!conflicted) {
      conflicted = true;
      // Expose only the affected key, never the stored record or entered answers.
      onConflict({ key });
    }
    return false;
  };
  const requireKey = key => {
    if (!APOLLO_KEYS.has(key)) throw new RangeError('This storage guard only handles Apollo progress.');
  };
  const check = key => {
    if (conflicted) return false;
    const keys = key == null ? [...baselines.keys()] : baselines.has(key) ? [key] : [];
    for (const currentKey of keys) {
      if (storage.getItem(currentKey) !== baselines.get(currentKey)) return noticeConflict(currentKey);
    }
    return true;
  };
  return {
    get conflicted() { return conflicted; },
    getItem(key) {
      requireKey(key);
      const raw = storage.getItem(key);
      if (!baselines.has(key)) baselines.set(key, raw);
      else if (raw !== baselines.get(key)) {
        noticeConflict(key);
        throw conflictError();
      }
      return raw;
    },
    setItem(key, value) {
      requireKey(key);
      if (conflicted) throw conflictError();
      if (!baselines.has(key)) throw new Error('Read the Apollo record before saving it.');
      if (!check(key)) throw conflictError();
      const raw = String(value);
      storage.setItem(key, raw);
      baselines.set(key, raw);
    },
    check
  };
}
