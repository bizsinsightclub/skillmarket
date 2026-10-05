import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // 클릭재킹·MIME 추측 방지. 데모 iframe(/files/…)은 같은 출처라 SAMEORIGIN 이면 된다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // 자동 표지(/skills/[slug]/cover)가 런타임에 읽는 한글 폰트를 배포 번들에 포함
  outputFileTracingIncludes: {
    "/skills/[slug]/cover": ["./node_modules/pretendard/dist/public/static/Pretendard-{ExtraBold,Medium}.otf"],
  },
};

export default nextConfig;
