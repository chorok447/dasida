CREATE TABLE `user_access_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `os` varchar(32) NOT NULL,
  `accessed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_access_logs_user_accessed` (`user_id`, `accessed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
