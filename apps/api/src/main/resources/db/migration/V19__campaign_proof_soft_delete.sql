-- 참여 인증 soft delete 전환: 신고된 인증을 작성자가 hard delete 로 증거 인멸할 수 있던 비대칭 해소
-- (게시글·댓글·캠페인은 이미 deletedAt 마킹으로 신고 대상을 보존한다).
ALTER TABLE `campaign_proofs`
    ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;

-- 재인증(삭제 후 재작성)은 기존 허용 동작 — soft delete 행이 남으면 unique 와 충돌하므로
-- '활성(미삭제) 인증 1개' 검증을 앱(campaign row lock 하 직렬화)으로 옮기고 일반 인덱스로 대체한다.
ALTER TABLE `campaign_proofs`
    DROP KEY `uk_campaign_proofs_campaign_author`,
    ADD KEY `idx_campaign_proofs_campaign_author` (`campaign_id`, `author_user_id`);
