"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useCurrentUserProfile } from "@/lib/use-current-user-profile";
import { notifyProfileUpdated } from "@/lib/auth";
import { updateProfile } from "@/data/users";

export function NotificationSettingsForm({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useCurrentUserProfile();
  const [saving, setSaving] = useState(false);
  const campaignNotify = profile?.notifyCampaignUpdates ?? true;
  const messageNotify = profile?.notifyMessages ?? true;

  // 두 설정을 함께 전송한다 — 미전달 필드는 서버 기본값(true)으로 리셋되기 때문.
  const save = async (next: { notifyCampaignUpdates: boolean; notifyMessages: boolean }) => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        name: profile.name,
        profileImageUrl: profile.profileImageUrl ?? null,
        ...next,
      });
      notifyProfileUpdated();
    } catch {
      toast.error("알림 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    {
      id: "campaign-notify-label",
      label: "캠페인 알림",
      checked: campaignNotify,
      toggle: () => save({ notifyCampaignUpdates: !campaignNotify, notifyMessages: messageNotify }),
    },
    {
      id: "message-notify-label",
      label: "메시지 알림",
      checked: messageNotify,
      toggle: () => save({ notifyCampaignUpdates: campaignNotify, notifyMessages: !messageNotify }),
    },
  ];

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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(var(--accent-rgb),0.15)] text-[var(--accent)]">
            <Bell size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id="notification-settings-title" className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>
              알림 설정
            </h2>
            <p className="mt-0.5 text-[12px] opacity-60" style={{ color: "var(--foreground)" }}>
              캠페인·메시지 알림 수신 여부를 설정합니다.
            </p>
          </div>
        </div>

        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between py-2.5">
            <span id={row.id} className="text-[13px]" style={{ color: "var(--foreground)" }}>{row.label}</span>
            <button
              type="button"
              role="switch"
              aria-labelledby={row.id}
              aria-checked={row.checked}
              disabled={!profile || saving}
              onClick={row.toggle}
              className="w-10 h-5 rounded-full p-0.5 transition-colors disabled:opacity-40"
              style={{
                background: row.checked
                  ? "var(--accent)"
                  : "rgba(var(--ink-rgb), 0.15)",
              }}
            >
              <motion.div
                animate={{ x: row.checked ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="w-4 h-4 rounded-full bg-white"
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
