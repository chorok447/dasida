-- 댓글 답글(1단계). parent_id 가 있으면 답글이며, 답글에는 다시 답글을 달 수 없다.
ALTER TABLE `post_comments`
    ADD COLUMN `parent_id` varchar(255) DEFAULT NULL,
    ADD KEY `idx_post_comments_parent_id` (`parent_id`);

ALTER TABLE `campaign_comments`
    ADD COLUMN `parent_id` varchar(255) DEFAULT NULL,
    ADD KEY `idx_campaign_comments_parent_id` (`parent_id`);
