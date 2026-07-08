-- 캠페인 참여 인증(후기). 참여자가 사진과 소감으로 참여를 인증한다. 1인 1인증.
CREATE TABLE `campaign_proofs` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) DEFAULT NULL,
  `author_user_id` bigint NOT NULL,
  `campaign_id` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `text` text NOT NULL,
  `images` json NOT NULL,
  `hidden_at` datetime(6) DEFAULT NULL,
  `hidden_reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_campaign_proofs_campaign_author` (`campaign_id`,`author_user_id`),
  KEY `idx_campaign_proofs_campaign_created` (`campaign_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
