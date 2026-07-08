-- 관리자 기능 도입: 사용자 역할(USER/ADMIN). 기존 사용자는 전원 USER.
ALTER TABLE `users`
    ADD COLUMN `role` varchar(20) NOT NULL DEFAULT 'USER';
