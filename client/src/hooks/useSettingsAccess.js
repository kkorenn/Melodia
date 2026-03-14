import { useCallback, useEffect, useState } from "react";
import { fetchSettingsAuthStatus } from "../lib/api";

const FALLBACK_AUTH_STATE = {
  loading: false,
  enabled: false,
  authenticated: true
};

export function isSettingsAuthRequiredError(error) {
  return error?.status === 401 || error?.code === "SETTINGS_AUTH_REQUIRED";
}

export function useSettingsAccess() {
  const [authState, setAuthState] = useState({
    loading: true,
    enabled: false,
    authenticated: false
  });

  useEffect(() => {
    let cancelled = false;

    fetchSettingsAuthStatus()
      .then((status) => {
        if (cancelled) {
          return;
        }

        setAuthState({
          loading: false,
          enabled: Boolean(status?.enabled),
          authenticated: Boolean(status?.authenticated)
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setAuthState(FALLBACK_AUTH_STATE);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markLocked = useCallback(() => {
    setAuthState({
      loading: false,
      enabled: true,
      authenticated: false
    });
  }, []);

  const canManageProtectedActions = !authState.enabled || authState.authenticated;

  return {
    ...authState,
    canManageProtectedActions,
    markLocked
  };
}
