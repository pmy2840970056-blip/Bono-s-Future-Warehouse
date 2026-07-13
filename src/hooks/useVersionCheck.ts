import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/** Returns true when the deployed version differs from the version we booted with. */
export function useVersionCheck(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip inside Lovable preview iframes and localhost
    if (window.top !== window.self) return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;

    let cancelled = false;
    let bootVersion: string | null = null;

    const check = async () => {
      const latest = await fetchLatestVersion();
      if (cancelled || !latest) return;
      if (bootVersion === null) {
        bootVersion = latest;
        return;
      }
      if (latest !== bootVersion) setHasUpdate(true);
    };

    // Prime the boot version once, then poll.
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return hasUpdate;
}
