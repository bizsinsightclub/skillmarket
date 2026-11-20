# 매일 13:05 (작업 스케줄러 "skillmarket-diagram") — 승인된 새 스킬의 구조도를 이 PC 의 Claude Code 가 archify 로 그려 올린다.
# 남이 올린 스킬 파일을 무인으로 읽으므로(프롬프트 인젝션) 도구를 좁게 연다:
#   읽기 = 작업 폴더·이 지시문·archify 스킬만 / 쓰기 = 작업 폴더만(Edit 규칙이 모든 파일 쓰기를 덮음) / 명령 = npm run diagram, archify CLI 만.
# 올리기(put)는 업로드 민감정보 검사를 한 번 더 거친다. 기록은 .diagram-work/daily.log
# 수동 실행: powershell -ExecutionPolicy Bypass -File scripts\diagram-daily.ps1 [-Extra "--slug x --force"]
param([string]$Extra = "")
$ErrorActionPreference = "Continue"
Set-Location "C:\pjt\skillmarket"
New-Item -ItemType Directory -Force ".diagram-work" | Out-Null
$log = "C:\pjt\skillmarket\.diagram-work\daily.log"
"=== $(Get-Date -Format s) ===" | Out-File $log -Append -Encoding utf8

$task = "Read scripts/diagram-prompt.md and follow it exactly."
if ($Extra) { $task += " In step 1 run: npm run diagram -- todo $Extra" }

$archify = "C:/Users/User/.agents/skills/archify"
$allowed = @(
  "Skill",
  "Read(./scripts/diagram-prompt.md)",
  "Read(./.diagram-work/**)",
  "Read(~/.agents/skills/archify/**)",
  "Read(~/.claude/skills/archify/**)",
  "Edit(./.diagram-work/**)",
  "Bash(npm run diagram:*)",
  "Bash(node $archify/bin/archify.mjs:*)"
)
& claude -p $task --allowedTools @allowed 2>&1 | Out-File $log -Append -Encoding utf8
"=== end $(Get-Date -Format s) (exit $LASTEXITCODE) ===" | Out-File $log -Append -Encoding utf8
