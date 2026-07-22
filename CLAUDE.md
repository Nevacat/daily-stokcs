# daily-stocks

뉴스를 주기적으로 수집·분석하여 섹터별 유망 종목을 추천 이유와 함께 보여주는 앱.

## 프로젝트 문서
- 기획서: @docs/기획서.md
- Claude 세팅 템플릿: docs/claude-project-template.md

## 모노레포 구조 (npm workspaces)

```
apps/
├── api/       # NestJS 백엔드 — 뉴스 수집·분석·추천 API
└── mobile/    # React Native 앱 (앱 이름: DailyStocks)
packages/
└── shared/    # @daily-stocks/shared — API·앱 공유 도메인 타입 (Sector, NewsItem, Recommendation 등)
```

## 자주 쓰는 명령 (루트에서 실행)

```bash
npm install            # 전체 워크스페이스 의존성 설치
npm run api:dev        # NestJS 개발 서버 (watch)
npm run api:test       # API 테스트
npm run mobile:start   # Metro 번들러 시작
npm run mobile:ios     # iOS 시뮬레이터 실행 (최초엔 cd apps/mobile/ios && pod install 필요)
npm run mobile:android # Android 에뮬레이터 실행
npm run test           # 전체 워크스페이스 테스트
npm run lint           # 전체 워크스페이스 린트
```

## 아키텍처 원칙
- 도메인 타입은 `packages/shared`에만 정의하고 api/mobile 양쪽에서 import 한다 (중복 정의 금지).
- shared를 수정하면 `npm run build -w @daily-stocks/shared` 후 사용한다.
- API 응답 포맷·에러 포맷은 @.claude/rules/api-design.md 를 따른다 (apps/api 작업 시 자동 적용).
- 추천 로직 파이프라인: 수집 → 전처리(중복 제거) → 분석(섹터/종목/감성) → 점수화 → 추천 생성 (기획서 §5).

## 브랜치 전략 (필수 준수)

- `main`: 릴리스 브랜치. `dev`: 개발 기본 브랜치. 모든 작업은 `dev`에서 파생한다.
- **기능별로 브랜치를 분리한다** — 한 브랜치에 여러 기능을 섞지 않는다. (`feature/*`, `chore/*`, `fix/*`)
- 작업이 끝나면 기능 단위로: 커밋 → push → PR(base: `dev`) → squash 머지 → 브랜치 삭제까지 완료한다.
- 릴리스 시점에 `dev` → `main` PR로 반영한다.

## 공통 원칙
- 커밋 메시지는 한국어로 작성한다.
- 뉴스 기사 본문은 저장하지 않는다 (제목 + 요약 + 원문 링크만).
- 투자 조언 표현("매수하세요" 등)은 코드/문구 어디에도 넣지 않는다. 사실 전달 톤 유지.
- 시크릿(.env, API 키)은 절대 커밋하지 않는다. 외부 API 키는 apps/api에서만 사용한다.
- 시각은 ISO 8601 UTC로 저장하고 표시 시점에 KST로 변환한다.
