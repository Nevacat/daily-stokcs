---
paths:
  - "apps/api/**"
---

# API 설계 규칙 (백엔드 코드를 다룰 때만 적용)

- REST 규칙: 리소스는 복수형 명사 (`/recommendations`, `/news`, `/sectors`).
- 응답 포맷 통일:
  ```json
  { "data": ..., "meta": { "collectedAt": "...", "nextCollectAt": "..." } }
  ```
- 에러 응답: `{ "error": { "code": "NEWS_FETCH_FAILED", "message": "..." } }`
- 시각은 항상 ISO 8601 UTC로 저장, 표시 시점에 KST 변환.
- 페이지네이션: `?cursor=` 기반 (offset 금지 — 뉴스는 실시간으로 늘어남).
- 외부 뉴스 API 키는 서버에서만 사용, 클라이언트 노출 금지.
