"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { notifyProfileUpdated } from "@/lib/auth";
import { updateProfile } from "@/data/users";

export function NotificationSettingsForm({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { profile } = useCurrentUserProfile();
  const [saving, setSaving] = useState(false);
  const campaignNotify = profile?.notifyCampaignUpdates ?? true;

  const toggle = async () => {
    if (!profile || saving) return;
    const next = !campaignNotify;
    setSaving(true);
    try {
      await updateProfile({
        name: profile.name,
        profileImageUrl: profile.profileImageUrl ?? null,
        notifyCampaignUpdates: next,
      });
      notifyProfileUpdated();
    } catch {
      toast.error("알림 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={embedded ? undefined : "mx-auto mb-6 max-w-5xl px-6 sm:px-8"}
      aria-labelledby="notification-settings-title"
    >
      <div
        className="rounded-3xl border p-5 sm:p-7"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7dd3a3]/15 text-[#7dd3a3]">
            <Bell size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="notification-settings-title" className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              알림 설정
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
              캠페인 관련 알림 수신 여부를 설정합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5">
          <span id="campaign-notify-label" className="text-[13px]" style={{ color: "var(--foreground)" }}>캠페인 알림</span>
          <button
            type="button"
            role="switch"
            aria-labelledby="campaign-notify-label"
            aria-checked={campaignNotify}
            disabled={!profile || saving}
            onClick={toggle}
            className="w-10 h-5 rounded-full p-0.5 transition-colors disabled:opacity-40"
            style={{
              background: campaignNotify
                ? "var(--accent)"
                : dark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(28,64,68,0.15)",
            }}
          >
            <motion.div
              animate={{ x: campaignNotify ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="w-4 h-4 rounded-full bg-white"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
