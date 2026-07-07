CREATE TABLE `campaign_bookmarks` (
  `id` varchar(255) NOT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_campaign_bookmarks_campaign_user` (`campaign_id`,`user_id`),
  KEY `idx_campaign_bookmarks_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
