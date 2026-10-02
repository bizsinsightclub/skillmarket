-- 알림함: 마지막으로 알림함을 연 시각. 이후에 생긴 알림 수를 헤더 배지로 보여준다.
ALTER TABLE app.users ADD COLUMN inbox_seen_at timestamptz NOT NULL DEFAULT now();
