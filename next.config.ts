import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 자동 표지(/skills/[slug]/cover)가 런타임에 읽는 한글 폰트를 배포 번들에 포함
  outputFileTracingIncludes: {
    "/skills/[slug]/cover": ["./node_modules/pretendard/dist/public/static/Pretendard-{ExtraBold,Medium}.otf"],
  },
};

export default nextConfig;
