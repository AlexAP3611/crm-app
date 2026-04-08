import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

/**
 * Custom hook to sync state with URL query parameters.
 */
export function useQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current params as object
  const params = useMemo(() => {
    const p = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== '') {
        p[key] = value;
      }
    }
    return p;
  }, [searchParams]);

  // Merge new params into URL
  const setQueryParams = useCallback((newParams) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.keys(newParams).forEach(key => {
        if (newParams[key] === null || newParams[key] === undefined || newParams[key] === '') {
          next.delete(key);
        } else {
          next.set(key, newParams[key]);
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Remove specific parameters
  const removeQueryParam = useCallback((key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  
  // Clear all params
  const clearQueryParams = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { params, setQueryParams, removeQueryParam, clearQueryParams };
}
