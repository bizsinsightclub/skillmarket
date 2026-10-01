import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 모든 업로드 파일은 Supabase Storage 비공개 버킷 하나. 서버만 secret 키로 접근한다.
// 경로 규칙: tmp/<user_id>/<uuid>.<ext>  (브라우저 직접 업로드, 검증 전)
//           skills/<skill_id>/versions/<version>.zip, skills/<skill_id>/snap/<uuid>.<ext>
export const BUCKET = "uploads";
export const BUCKET_FILE_LIMIT = 20 * 1024 * 1024;

let client: SupabaseClient | undefined;

function storage() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 필요합니다");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client.storage.from(BUCKET);
}

function check<T>({ data, error }: { data: T | null; error: Error | null }, what: string): T {
  if (error || data === null) throw new Error(`스토리지 ${what} 실패: ${error?.message ?? "응답 없음"}`);
  return data;
}

export async function ensureBucket() {
  storage(); // 클라이언트 초기화
  const { error } = await client!.storage.createBucket(BUCKET, { public: false, fileSizeLimit: BUCKET_FILE_LIMIT });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function signedUploadUrl(path: string) {
  return check(await storage().createSignedUploadUrl(path), "업로드 URL 발급");
}

export async function download(path: string) {
  const blob = check(await storage().download(path), `다운로드(${path})`);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function upload(path: string, data: Uint8Array, contentType: string) {
  check(await storage().upload(path, data, { contentType, upsert: false }), `업로드(${path})`);
}

export async function move(from: string, to: string) {
  check(await storage().move(from, to), `이동(${from})`);
}

export async function remove(paths: string[]) {
  if (paths.length) await storage().remove(paths); // 실패해도 치명적이지 않음(고아 파일)
}

export async function signedUrl(path: string, expiresIn: number, downloadName?: string) {
  return check(await storage().createSignedUrl(path, expiresIn, downloadName ? { download: downloadName } : undefined), "서명 URL 발급").signedUrl;
}

export async function removeSkillFiles(skillId: number) {
  const paths: string[] = [];
  for (const dir of ["versions", "snap"]) {
    const prefix = `skills/${skillId}/${dir}`;
    const { data } = await storage().list(prefix, { limit: 1000 });
    for (const f of data ?? []) paths.push(`${prefix}/${f.name}`);
  }
  await remove(paths);
}
