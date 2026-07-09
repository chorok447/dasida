-- 접속 기록에 브라우저(User-Agent 파싱)와 대략적인 위치(IP 기반 비동기 조회)를 추가한다.
-- 기존 행은 수집 이전이라 NULL 로 남긴다.
ALTER TABLE user_access_logs
    ADD COLUMN browser VARCHAR(32) NULL,
    ADD COLUMN country VARCHAR(64) NULL,
    ADD COLUMN region VARCHAR(64) NULL;
