"use client";

import { createClient } from "@supabase/supabase-js";
import { prepareUpload, type UploadSpec } from "@/lib/skill-actions";

const FILE_FIELDS = ["zip", "images", "demo", "lens"] as const;

// 폼의 파일들을 서버를 거치지 않고 Storage 에 직접 올린 뒤(1회용 서명 URL),
// 파일 대신 임시 경로(<field>_tmp)를 담은 FormData 를 돌려준다. 실패하면 에러 문구.
export async function uploadForm(form: HTMLFormElement): Promise<FormData | string> {
  try {
    return await upload(form);
  } catch (e) {
    return `파일 업로드에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function upload(form: HTMLFormElement): Promise<FormData | string> {
  const data = new FormData(form);
  const files: { field: UploadSpec["field"]; file: File }[] = [];
  for (const field of FILE_FIELDS) {
    for (const f of data.getAll(field)) if (f instanceof File && f.size > 0) files.push({ field, file: f });
    data.delete(field);
  }
  if (!files.length) return data;

  const res = await prepareUpload(files.map(({ field, file }) => ({ field, name: file.name, size: file.size })));
  if (!res.tickets) return res.error ?? "업로드 준비에 실패했습니다";

  // 공개(publishable) 키로 충분하다: 업로드 권한은 서버가 발급한 토큰에만 있다
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!).storage.from("uploads");
  const results = await Promise.all(
    res.tickets.map((t, i) => storage.uploadToSignedUrl(t.path, t.token, files[i].file, { contentType: files[i].file.type || "application/octet-stream" })),
  );
  const failed = results.find((r) => r.error);
  if (failed) return `파일 업로드에 실패했습니다: ${failed.error!.message}`;
  for (const t of res.tickets) data.append(`${t.field}_tmp`, t.path); // 순서 유지(첫 이미지 = 썸네일)
  return data;
}
