#!/bin/bash
# PostToolUse 훅: Edit/Write 직후 해당 파일을 Prettier로 포맷
# stdin으로 훅 이벤트 JSON이 들어온다.

file_path=$(jq -r '.tool_input.file_path // empty')

# 포맷 대상 확장자만 처리
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    if command -v npx >/dev/null 2>&1 && [ -f "$file_path" ]; then
      npx --no-install prettier --write "$file_path" >/dev/null 2>&1
    fi
    ;;
esac

exit 0
