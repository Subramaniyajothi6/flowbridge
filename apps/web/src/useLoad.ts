import { useCallback, useEffect, useState } from "react";

// Loads data when a screen opens. Call reload() to fetch it again.
export function useLoad<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
