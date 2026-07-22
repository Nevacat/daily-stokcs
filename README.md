# daily-stocks

뉴스 기반 섹터별 종목 추천 앱. 기획서는 [docs/기획서.md](docs/기획서.md) 참고.

## 구성 (npm workspaces 모노레포)

| 경로 | 스택 | 설명 |
|---|---|---|
| `apps/api` | NestJS (TypeScript) | 뉴스 수집·분석·추천 API |
| `apps/mobile` | React Native 0.86 | iOS/Android 앱 |
| `packages/shared` | TypeScript | 공유 도메인 타입 |

## 시작하기

```bash
npm install

# 백엔드
npm run api:dev

# 모바일 (별도 터미널)
npm run mobile:start
npm run mobile:ios      # 최초 1회: cd apps/mobile/ios && bundle install && bundle exec pod install
npm run mobile:android
```

> 본 서비스가 제공하는 정보는 투자 참고용이며, 투자 판단의 책임은 이용자에게 있습니다.
