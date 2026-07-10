"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";
import { NotificationSettingsForm } from "./notification-settings-form";

export function MypageAccountPanel({
  currentEmail,
  profileName,
  onEmailChanged,
}: {
  currentEmail: string;
  profileName: string;
  onEmailChanged: (email: string) => void;
}) {
  return (
    <div className="space-y-6">
      <ChangeEmailForm embedded currentEmail={currentEmail} onChanged={onEmailChanged} />
      <ChangePasswordForm embedded profileName={profileName} />
      <NotificationSettingsForm embedded />
      <Link
        href="/mypage/blocked"
        className="flex items-center gap-3 rounded-2xl border p-5 transition-transform hover:-translate-y-0.5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <ShieldOff size={18} aria-hidden style={{ color: "var(--foreground-muted)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>차단 사용자 관리</p>
          <p className="text-[12px]" style={{ color: "var(--foreground-muted)" }}>
            내가 차단한 사용자를 확인하고 해제할 수 있어요.
          </p>
        </div>
      </Link>
      <DeleteAccountForm embedded />
    </div>
  );
}
