-- DM 메시지 삭제(soft delete). 본문은 남기되 deleted_at 마킹 후 응답에서 마스킹한다(신고 대상 보존).
ALTER TABLE `messages` ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;
