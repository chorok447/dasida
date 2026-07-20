-- 피드/검색 인기·토론·조회수·참여 정렬 인덱스 보강.
--
-- V18 은 `(hidden_at, seq)` 만 추가해 LATEST 정렬만 인덱스를 탄다.
-- POPULAR/DISCUSSED/VIEWS(및 캠페인 POPULAR)는 `hidden_at IS NULL` 필터 후
-- likes/comments/view_count/joined_count DESC 로 정렬하는데, 선행 정렬 컬럼이
-- 인덱스에 없어 매 요청마다 filesort 였다. 필터(등가) + 정렬 컬럼 + seq 를 묶어
-- filesort 를 제거한다. DESC 정렬은 오름차순 인덱스를 역방향 스캔해 커버된다.
ALTER TABLE `posts`
    ADD KEY `idx_posts_hidden_likes_seq` (`hidden_at`, `likes`, `seq`),
    ADD KEY `idx_posts_hidden_comments_seq` (`hidden_at`, `comments`, `seq`),
    ADD KEY `idx_posts_hidden_views_seq` (`hidden_at`, `view_count`, `seq`);

ALTER TABLE `campaigns`
    ADD KEY `idx_campaigns_hidden_joined_seq` (`hidden_at`, `joined_count`, `seq`);
