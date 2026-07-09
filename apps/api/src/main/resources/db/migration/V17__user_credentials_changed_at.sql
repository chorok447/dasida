-- 자격증명(비밀번호·이메일) 마지막 변경 시각. 이 시각 이전에 발급된 refresh/access 토큰을 거절해
-- 비밀번호 변경이 탈취된 토큰(특히 rotation 으로 영구 연장되는 refresh)을 실제로 무효화하게 한다.
-- 기존 회원은 NULL(변경 이력 없음 — 모든 토큰 유효).
ALTER TABLE `users`
    ADD COLUMN `credentials_changed_at` datetime(6) DEFAULT NULL;
