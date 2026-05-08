import { useEffect, useState } from "react";

import { getCurrentOwnerSession, type OwnerSession } from "@/services/authService";

export function useAppSession() {
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getCurrentOwnerSession()
      .then((nextSession) => {
        if (mounted) setSession(nextSession);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { session, loading };
}
