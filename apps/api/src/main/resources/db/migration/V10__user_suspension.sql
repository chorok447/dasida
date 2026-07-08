-- 회원 정지(제재). suspended_until IS NULL 또는 과거 = 정상, 미래 = 정지 중.
-- JwtAuthFilter 가 매 요청 검사하므로 기존 토큰에도 즉시 적용된다.
ALTER TABLE `users`
    ADD COLUMN `suspended_until` datetime(6) DEFAULT NULL,
    ADD COLUMN `suspended_reason` varchar(500) DEFAULT NULL;
