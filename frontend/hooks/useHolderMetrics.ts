"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHolderCount,
  type HolderMetrics,
} from "@/lib/holderIndexer";

export type UseHolderMetricsReturn = {
  metrics: HolderMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHolderMetrics(pollMs = 30000): UseHolderMetricsReturn {
  const [metrics, setMetrics] = useState<HolderMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const hasCompletedRequestRef = useRef(false);

  const runRefresh = useCallback(async () => {
    const requestId = ++requestSequenceRef.current;
    if (!mountedRef.current) return;

    if (!hasCompletedRequestRef.current) setLoading(true);
    setError(null);

    try {
      const nextMetrics = await getHolderCount();
      if (
        !mountedRef.current ||
        requestId !== requestSequenceRef.current
      ) {
        return;
      }
      setMetrics(nextMetrics);
      setLoading(false);
      hasCompletedRequestRef.current = true;
    } catch (cause) {
      if (
        !mountedRef.current ||
        requestId !== requestSequenceRef.current
      ) {
        return;
      }
      setError(cause instanceof Error ? cause.message : String(cause));
      setLoading(false);
      hasCompletedRequestRef.current = true;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    hasCompletedRequestRef.current = false;
    void runRefresh();

    const id = setInterval(() => {
      void runRefresh();
    }, pollMs);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      clearInterval(id);
    };
  }, [runRefresh, pollMs]);

  return { metrics, loading, error, refresh: runRefresh };
}

export default useHolderMetrics;
