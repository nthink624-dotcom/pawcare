"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export default function OwnerInstalledAppVersion() {
  const [versionLabel, setVersionLabel] = useState("확인 중...");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setVersionLabel("웹에서 사용 중");
      return;
    }
    if (!Capacitor.isPluginAvailable("App")) {
      setVersionLabel("앱 업데이트 후 확인 가능");
      return;
    }

    let active = true;
    const unavailable = "버전 정보를 확인할 수 없어요";
    const timer = window.setTimeout(() => {
      if (active) setVersionLabel(unavailable);
    }, 3000);

    void App.getInfo()
      .then((info) => {
        const version = info.version?.trim();
        const build = info.build?.trim();
        if (active) setVersionLabel(version && build ? `${version} (${build})` : unavailable);
      })
      .catch(() => {
        if (active) setVersionLabel(unavailable);
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex min-h-[52px] w-full items-center gap-3 px-1 py-2.5 text-left">
      <Smartphone className="h-[18px] w-[18px] shrink-0 text-[var(--text)]" strokeWidth={1.9} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[16px] font-medium text-[var(--text)]">앱 버전</p>
        <p className="mt-0.5 break-words text-[13px] font-normal text-[var(--muted)]" role="status">{versionLabel}</p>
      </div>
    </div>
  );
}
