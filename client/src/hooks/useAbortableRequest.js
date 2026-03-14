import { useEffect, useRef, useState } from "react";

export function useAbortableRequest(task, deps, options = {}) {
  const {
    enabled = true,
    fallbackErrorMessage = "Request failed"
  } = options;
  const [loading, setLoading] = useState(Boolean(enabled));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const controller = new AbortController();
    const initialLoad = !hasLoadedRef.current;

    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    Promise.resolve(task(controller.signal))
      .then(() => {
        hasLoadedRef.current = true;
      })
      .catch((errorValue) => {
        if (errorValue?.name === "AbortError") {
          return;
        }
        setError(errorValue?.message || fallbackErrorMessage);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, deps);

  return {
    loading,
    refreshing,
    error,
    setError
  };
}
