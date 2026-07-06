CREATE TABLE `conversations` (
  `id` varchar(64) NOT NULL,
  `user_low_id` bigint NOT NULL,
  `user_high_id` bigint NOT NULL,
  `last_message_id` varchar(64) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversations_pair` (`user_low_id`, `user_high_id`),
  KEY `idx_conversations_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `conversation_members` (
  `id` varchar(64) NOT NULL,
  `conversation_id` varchar(64) NOT NULL,
  `user_id` bigint NOT NULL,
  `last_read_message_id` varchar(64) DEFAULT NULL,
  `joined_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversation_members_pair` (`conversation_id`, `user_id`),
  KEY `idx_conversation_members_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `messages` (
  `id` varchar(64) NOT NULL,
  `conversation_id` varchar(64) NOT NULL,
  `sender_id` bigint NOT NULL,
  `content` text NOT NULL,
  `type` varchar(32) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `seq` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation_seq` (`conversation_id`, `seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_blocks` (
  `id` varchar(64) NOT NULL,
  `blocker_id` bigint NOT NULL,
  `blocked_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_blocks_pair` (`blocker_id`, `blocked_id`),
  KEY `idx_user_blocks_blocked` (`blocked_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
