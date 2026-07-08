-- 신고 처리(관리자) 도입: 상태·처리자·처리 시각·처리 메모. 기존 신고는 전부 PENDING.
ALTER TABLE `reports`
    ADD COLUMN `status` varchar(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `resolved_by_user_id` bigint DEFAULT NULL,
    ADD COLUMN `resolved_at` datetime(6) DEFAULT NULL,
    ADD COLUMN `resolution_note` varchar(500) DEFAULT NULL;

-- 관리자 신고 큐(상태 필터 + seq DESC 정렬)용.
CREATE INDEX `idx_reports_status_seq` ON `reports` (`status`, `seq`);
