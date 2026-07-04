-- V1 baseline: 도입 시점(2026-07)의 전체 스키마.
-- 기존 ddl-auto=update 가 만들어온 스키마를 그대로 옮긴 것(현재 엔티티와 1:1 일치 검증됨).
-- 이미 테이블이 있는 DB 는 baseline-on-migrate 로 V1 을 건너뛰고, 빈 DB 만 이 파일로 생성된다.
-- 이후 스키마 변경은 V2__*.sql 부터 추가한다.


CREATE TABLE `campaign_comments` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) DEFAULT NULL,
  `author_user_id` bigint DEFAULT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `text` text,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_campaign_comments_campaign_created` (`campaign_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `campaign_participants` (
  `id` varchar(255) NOT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKm54u6pnui3u92o38tujhsxco9` (`campaign_id`,`user_id`),
  KEY `idx_campaign_participants_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `campaigns` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) DEFAULT NULL,
  `author_user_id` bigint DEFAULT NULL,
  `body` json DEFAULT NULL,
  `capacity` int NOT NULL,
  `days_left_label` varchar(255) DEFAULT NULL,
  `joined_count` int DEFAULT NULL,
  `recruit_end` varchar(255) DEFAULT NULL,
  `recruit_start` varchar(255) DEFAULT NULL,
  `run_end` varchar(255) DEFAULT NULL,
  `run_start` varchar(255) DEFAULT NULL,
  `seq` bigint NOT NULL,
  `status` varchar(255) DEFAULT NULL,
  `summary` text,
  `thumb` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_author_user_id` (`author_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notifications` (
  `id` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `href` varchar(255) NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `seq` bigint NOT NULL,
  `time` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read_seq` (`user_id`,`read_at`,`seq`),
  KEY `idx_notifications_user_seq` (`user_id`,`seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `post_bookmarks` (
  `id` varchar(255) NOT NULL,
  `post_id` varchar(255) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK3hralg8r0y2lc96pbp3km8mrj` (`post_id`,`user_id`),
  KEY `idx_post_bookmarks_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `post_comments` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) DEFAULT NULL,
  `author_user_id` bigint DEFAULT NULL,
  `post_id` varchar(255) DEFAULT NULL,
  `seq` bigint NOT NULL,
  `text` text,
  `time_label` varchar(255) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `post_likes` (
  `id` varchar(255) NOT NULL,
  `post_id` varchar(255) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK5l2rj28vw5oj6f7ox746grokg` (`post_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `posts` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) DEFAULT NULL,
  `author_user_id` bigint DEFAULT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `comments` int NOT NULL,
  `images` json DEFAULT NULL,
  `likes` int NOT NULL,
  `seq` bigint NOT NULL,
  `tags` json DEFAULT NULL,
  `content` text,
  `time_label` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_posts_author_user_id` (`author_user_id`),
  KEY `idx_posts_campaign_id` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `reports` (
  `id` varchar(255) NOT NULL,
  `detail` text,
  `reason` varchar(255) NOT NULL,
  `reporter_user_id` bigint NOT NULL,
  `seq` bigint NOT NULL,
  `target_id` varchar(255) NOT NULL,
  `target_type` varchar(255) NOT NULL,
  `time_label` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reports_reporter_target` (`reporter_user_id`,`target_type`,`target_id`),
  KEY `idx_reports_reporter_seq` (`reporter_user_id`,`seq`),
  KEY `idx_reports_target` (`target_type`,`target_id`),
  KEY `idx_reports_seq` (`seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `deleted_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `verified` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
