-- 모집 마감 임박(D-1) 알림의 멱등성 마커. 배치가 재기동/중복 실행돼도
-- 캠페인당 1회만 발송되도록 발송 시각을 기록한다. NULL = 미발송.
ALTER TABLE `campaigns`
    ADD COLUMN `recruit_end_reminder_sent_at` datetime(6) DEFAULT NULL;
