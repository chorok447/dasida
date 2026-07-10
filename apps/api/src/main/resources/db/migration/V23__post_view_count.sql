-- 게시글 조회수. 클라이언트가 상세 진입 시 POST /api/posts/{id}/views 로 1회 기록한다.
alter table posts add column view_count bigint not null default 0;
