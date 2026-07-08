-- 관리자 감사 로그: 누가 언제 무엇을 조치했는지 기록.
-- 신고 처리(REPORT_*), 콘텐츠 숨김/복구(CONTENT_*), 회원 정지/해제(USER_*)가 기록된다.
CREATE TABLE `admin_action_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_user_id` bigint NOT NULL,
  `action` varchar(30) NOT NULL,
  `target_type` varchar(30) NOT NULL,
  `target_id` varchar(64) NOT NULL,
  `detail` varchar(500) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admin_action_logs_action_id` (`action`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
