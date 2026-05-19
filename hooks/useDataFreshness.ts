import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * useDataFreshness - A hook to manage data freshness in PWA/web environments
 *
 * This hook:
 * 1. Listens to visibility change events (tab focus/blur, app background/foreground)
 * 2. Triggers data refresh when the app/tab becomes visible
 * 3. Provides cache busting utilities for Firebase queries
 *
 * @param refreshFn - Function to call when data needs to be refreshed
 * @param options - Configuration options
 */
export interface UseDataFreshnessOptions {
  /** Whether to refresh when the app/tab becomes visible */
  refreshOnFocus?: boolean;
  /** Minimum time between refreshes (in ms) to avoid excessive requests */
  minRefreshInterval?: number;
  /** Whether to clear memory cache on focus */
  clearMemoryCache?: boolean;
  /** Callback when refresh is triggered */
  onRefresh?: () => void;
}

export function useDataFreshness(
  refreshFn: () => Promise<void> | void,
  options: UseDataFreshnessOptions = {},
) {
  const {
    refreshOnFocus = true,
    minRefreshInterval = 30000, // 30 seconds default
    clearMemoryCache = true,
    onRefresh,
  } = options;

  const lastRefreshTime = useRef<number>(0);
  const refreshFnRef = useRef(refreshFn);
  const isRefreshing = useRef(false);

  // Update the refresh function ref if it changes
  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, [refreshFn]);

  const triggerRefresh = useCallback(
    async (force = false) => {
      const now = Date.now();

      // Skip if we're already refreshing
      if (isRefreshing.current && !force) return;

      // Skip if we refreshed recently (unless force)
      if (!force && now - lastRefreshTime.current < minRefreshInterval) {
        return;
      }

      isRefreshing.current = true;
      lastRefreshTime.current = now;

      try {
        await refreshFnRef.current();
        onRefresh?.();
      } catch (error) {
        console.error("[useDataFreshness] Refresh failed:", error);
      } finally {
        isRefreshing.current = false;
      }
    },
    [minRefreshInterval, onRefresh],
  );

  // Handle visibility change
  useEffect(() => {
    if (Platform.OS !== "web" || !refreshOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Clear memory caches when tab becomes visible
        if (clearMemoryCache) {
          // Clear any in-memory data caches
          // This will be picked up by components that use memory caching
          window.dispatchEvent(new CustomEvent("edueaz:clearMemoryCache"));
        }
        triggerRefresh();
      }
    };

    // Handle focus event for PWA windows
    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Handle pageshow for back/forward navigation
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache, refresh data
        triggerRefresh(true);
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [refreshOnFocus, clearMemoryCache, triggerRefresh]);

  // Handle online/offline events
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleOnline = () => {
      // When coming back online, trigger a refresh
      triggerRefresh(true);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [triggerRefresh]);

  return {
    refresh: triggerRefresh,
    lastRefreshTime: lastRefreshTime.current,
  };
}

/**
 * Cache busting utility for Firebase queries
 * Add this to your query to ensure fresh data
 */
export function withCacheBusting<T extends { timestamp?: number }>(data: T): T {
  return {
    ...data,
    _cacheBust: Date.now(),
  };
}

/**
 * Clear all memory caches - call this when user logs out or switches accounts
 */
export function clearAllMemoryCaches() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edueaz:clearAllCaches"));
  }
}

export default useDataFreshness;
