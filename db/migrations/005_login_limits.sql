-- 로그인 코드 발송 한도를 IP 별로도 건다(무작위 대입·메일 폭탄 방지)
ALTER TABLE app.login_codes ADD COLUMN ip text NOT NULL DEFAULT '';
CREATE INDEX login_codes_created ON app.login_codes (created_at);
