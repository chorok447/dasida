-- 가입 시각. 기존 회원은 가입 시점을 알 수 없으므로 NULL 로 남긴다(백필하지 않음 — 정직한 표기).
-- 신규 가입은 애플리케이션(AuthService.signup)이 기록한다.
ALTER TABLE `users`
    ADD COLUMN `created_at` datetime(6) DEFAULT NULL;
