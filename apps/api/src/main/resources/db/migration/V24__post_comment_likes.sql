-- 게시글 댓글 좋아요. (comment_id, user_id) unique 로 중복 좋아요를 막고,
-- 카운트는 카운터 컬럼 없이 목록 조회 시 group by 집계로 계산한다.
CREATE TABLE `post_comment_likes` (
  `id` varchar(255) NOT NULL,
  `comment_id` varchar(255) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_comment_likes_comment_user` (`comment_id`,`user_id`),
  KEY `idx_post_comment_likes_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
