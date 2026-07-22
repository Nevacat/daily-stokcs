#!/bin/bash
# PreToolUse 훅: 위험한 것을 자동으로 차단 (exit 2 = 차단)
#  1) Bash — 위험한 명령 (rm -rf, force push 등)
#  2) Edit/Write — 저장되는 내용에 시크릿(API 키 등) 패턴
# stdin으로 훅 이벤트 JSON이 들어온다.

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# --- 1) 위험한 명령 차단 (Bash) ---
if [ "$tool_name" = "Bash" ]; then
  command=$(echo "$input" | jq -r '.tool_input.command // empty')

  dangerous=(
    'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f'     # rm -rf / rm -fr
    'git[[:space:]]+push[[:space:]]+.*(--force|-f)([[:space:]]|$)'
    'git[[:space:]]+reset[[:space:]]+--hard'
    'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
    'chmod[[:space:]]+-R[[:space:]]+777'
    '>[[:space:]]*/dev/sd'
    'mkfs\.'
    'DROP[[:space:]]+(TABLE|DATABASE)'
  )

  for p in "${dangerous[@]}"; do
    if echo "$command" | grep -qiE "$p"; then
      echo "위험한 명령 패턴이 감지되어 차단했습니다: $p" >&2
      echo "정말 필요하다면 사용자가 직접 터미널에서 실행하세요." >&2
      exit 2
    fi
  done
  exit 0
fi

# --- 2) 시크릿 패턴 차단 (Edit/Write) ---
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
[ -z "$content" ] && exit 0

patterns=(
  'AKIA[0-9A-Z]{16}'                      # AWS Access Key
  'sk-[A-Za-z0-9_-]{20,}'                 # OpenAI/Anthropic 류 API 키
  'ghp_[A-Za-z0-9]{36}'                   # GitHub PAT
  'xox[baprs]-[A-Za-z0-9-]{10,}'          # Slack 토큰
  '-----BEGIN( RSA| EC| OPENSSH)? PRIVATE KEY-----'
  '(password|passwd|secret|api[_-]?key)[[:space:]]*[:=][[:space:]]*["'\''][^"'\'']{8,}'
)

for p in "${patterns[@]}"; do
  if echo "$content" | grep -qiE "$p"; then
    echo "시크릿으로 의심되는 패턴이 감지되어 차단했습니다: $p" >&2
    echo "실제 키가 맞다면 .env로 옮기고 코드에서는 환경변수로 참조하세요." >&2
    exit 2
  fi
done

exit 0
