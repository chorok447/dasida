-- DM(새 메시지) 알림 수신 설정. notify_campaign_updates(V6)와 동일 패턴.
ALTER TABLE users
    ADD COLUMN notify_messages BOOLEAN NOT NULL DEFAULT TRUE;
