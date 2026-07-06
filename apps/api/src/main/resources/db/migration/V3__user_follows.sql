CREATE TABLE `user_follows` (
  `id` varchar(64) NOT NULL,
  `follower_id` bigint NOT NULL,
  `followee_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_follows_pair` (`follower_id`, `followee_id`),
  KEY `idx_user_follows_followee` (`followee_id`),
  KEY `idx_user_follows_follower` (`follower_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
