-- post_comments: author_user_id 인덱스 보강.
--
-- 마이페이지 활동 탭(findCommentedPostIds: author_user_id 필터 + post_id group by)과
-- 회원 탈퇴/프로필 변경의 author_user_id 조건 일괄 UPDATE(anonymizeAuthor/syncAuthorProfile)가
-- 지금까지 인덱스 없이 풀스캔이었다. posts 의 idx_posts_author_user_id 와 대칭.
ALTER TABLE `post_comments`
    ADD KEY `idx_post_comments_author_user_id` (`author_user_id`);
