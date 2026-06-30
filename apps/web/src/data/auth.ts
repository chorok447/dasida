import { apiDeleteWithBody, apiPut } from "@/lib/api";

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  changed: boolean;
  token: string | null;
};

export type DeleteAccountRequest = {
  currentPassword: string;
  confirmText: string;
};

export type DeleteAccountResponse = {
  deleted: boolean;
};

export type PasswordPolicyState = {
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  lengthValid: boolean;
  valid: boolean;
};

export const PASSWORD_POLICY_MESSAGE = "비밀번호는 8~15자이며 영문, 숫자, 특수문자를 포함해야 합니다.";

export function getPasswordPolicyState(password: string): PasswordPolicyState {
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const lengthValid = password.length >= 8 && password.length <= 15;
  return {
    hasLetter,
    hasNumber,
    hasSpecial,
    lengthValid,
    valid: hasLetter && hasNumber && hasSpecial && lengthValid,
  };
}

export function changePassword(
  body: ChangePasswordRequest,
  token: string,
): Promise<ChangePasswordResponse> {
  return apiPut<ChangePasswordResponse>("/api/auth/password", body, token);
}

export function deleteAccount(
  body: DeleteAccountRequest,
  token: string,
): Promise<DeleteAccountResponse> {
  return apiDeleteWithBody<DeleteAccountResponse>("/api/auth/me", body, token);
}
