-- 콘텐츠 soft delete. 작성자 삭제 시 row 를 지우지 않고 deleted_at 을 마킹한다
-- (신고 대상 보존·복구 여지). 공개 노출 제외는 hidden_at 을 함께 세팅해 기존 경로를 재사용하고,
-- deleted_at IS NOT NULL 이면 작성자 본인·관리자 복구 경로에서도 존재하지 않는 것으로 취급한다.
ALTER TABLE `posts`
    ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;

ALTER TABLE `campaigns`
    ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;

ALTER TABLE `post_comments`
    ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;

ALTER TABLE `campaign_comments`
    ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;
