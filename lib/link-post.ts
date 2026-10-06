import { UploadError } from "./skill-zip.ts";

// 링크형 글(플러그인·MCP)은 zip 대신 이 '등록본' 버전 한 줄을 갖는다 → 큐레이션(버전 승인) 모델을 그대로 쓴다
export const LINK_VERSION = "link";

export type LinkFields = { maker: string; install_cmd: string; homepage_url: string };

export function readLinkFields(raw: LinkFields): LinkFields {
  const maker = raw.maker.trim().slice(0, 80);
  const install_cmd = raw.install_cmd.trim().slice(0, 2000);
  const homepage_url = raw.homepage_url.trim().slice(0, 500);
  if (!maker) throw new UploadError("만든 곳(제작자)을 입력하세요");
  if (!install_cmd && !homepage_url) throw new UploadError("설치 명령이나 공식 페이지 중 하나는 입력하세요");
  if (homepage_url && !isHttpUrl(homepage_url)) throw new UploadError("공식 페이지는 http(s) 주소만 쓸 수 있습니다");
  return { maker, install_cmd, homepage_url };
}

// javascript:, data: 같은 주소가 링크로 박히지 않게 — 사용자가 넣는 링크는 모두 이걸 거친다
export function isHttpUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
