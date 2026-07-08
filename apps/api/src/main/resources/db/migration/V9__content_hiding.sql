-- 관리자 콘텐츠 숨김(soft hide). 삭제와 달리 되돌릴 수 있고, 신고 처리(제재)의 실행 수단이 된다.
-- hidden_at IS NULL = 공개. 값이 있으면 공개 목록/검색/sitemap/상세(작성자 제외)에서 제외된다.
ALTER TABLE `posts`
    ADD COLUMN `hidden_at` datetime(6) DEFAULT NULL,
    ADD COLUMN `hidden_reason` varchar(500) DEFAULT NULL;

ALTER TABLE `campaigns`
    ADD COLUMN `hidden_at` datetime(6) DEFAULT NULL,
    ADD COLUMN `hidden_reason` varchar(500) DEFAULT NULL;

ALTER TABLE `post_comments`
    ADD COLUMN `hidden_at` datetime(6) DEFAULT NULL,
    ADD COLUMN `hidden_reason` varchar(500) DEFAULT NULL;

ALTER TABLE `campaign_comments`
    ADD COLUMN `hidden_at` datetime(6) DEFAULT NULL,
    ADD COLUMN `hidden_reason` varchar(500) DEFAULT NULL;
