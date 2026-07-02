"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import type { Campaign } from "@/data/campaigns";
import {
  CampaignForm,
  DEFAULT_CAMPAIGN_FORM_VALUES,
  type CampaignPayload,
} from "../campaign-form";

export default function CampaignCreatePage() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      alert("로그인이 필요합니다.");
      router.replace("/login");
    }
  }, [router]);

  const submit = async (payload: CampaignPayload) => {
    if (submittingRef.current) return;
    const requestToken = getToken();
    if (!requestToken) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setRequestError("");
    try {
      const created = await apiPost<Campaign>("/api/campaigns", payload);
      if (getToken() !== requestToken) return;
      router.replace(`/campaigns/${created.id}`);
    } catch (error) {
      if (getToken() !== requestToken) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        alert("로그인이 필요합니다.");
        router.push("/login");
      } else if (error instanceof ApiError && error.status === 400) {
        setRequestError("입력값을 확인해주세요.");
      } else {
        setRequestError("등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <CampaignForm
      initialValues={DEFAULT_CAMPAIGN_FORM_VALUES}
      eyebrow="Create Campaign"
      heading="새 캠페인 개설"
      submitLabel="캠페인 등록"
      submittingLabel="등록 중…"
      submitting={submitting}
      requestError={requestError}
      backLabel="캠페인 목록"
      onBack={() => router.push("/campaigns")}
      onSubmit={submit}
    />
  );
}
