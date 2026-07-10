-- 핫 패스 조회 인덱스 보강.
--
-- posts/campaigns: 피드·검색·사이트맵이 `hidden_at IS NULL` 필터 + `seq` 정렬을 쓰는데
-- 지금까지 둘 다 인덱스가 없어 풀스캔 + filesort 였다.
ALTER TABLE `posts`
    ADD KEY `idx_posts_hidden_seq` (`hidden_at`, `seq`);

ALTER TABLE `campaigns`
    ADD KEY `idx_campaigns_hidden_seq` (`hidden_at`, `seq`);

-- post_comments: post_id 계열 인덱스가 전혀 없어(PRIMARY + parent_id 뿐) 게시글 상세마다 타는
-- 댓글 목록/카운트/페이지 계산이 전부 풀스캔이었다. campaign_comments 의
-- idx_campaign_comments_campaign_created 와 대칭.
ALTER TABLE `post_comments`
    ADD KEY `idx_post_comments_post_hidden_seq` (`post_id`, `hidden_at`, `seq`);
