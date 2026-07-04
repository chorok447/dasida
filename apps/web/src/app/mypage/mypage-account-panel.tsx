"use client";

import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";

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
      <DeleteAccountForm embedded />
    </div>
  );
}
