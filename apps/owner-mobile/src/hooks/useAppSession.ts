import { useEffect, useState } from "react";

import { defaultAuthSessionProvider, type OwnerSession } from "@/services/authService";
import type { AuthSessionProvider } from "@/services/authSessionProvider";

export function useAppSession(authSessionProvider: AuthSessionProvider = defaultAuthSessionProvider) {
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    authSessionProvider
      .restoreSession()
      .then((nextSession) => {
        if (mounted) setSession(nextSession);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authSessionProvider]);

  return { session, loading };
}
