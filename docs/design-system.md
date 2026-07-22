# DeTok Design System

> Version 1.0 — 원본 브랜드 가이드. 코드 반영은 `apps/mobile/src/theme/tokens.ts` 참조.

## Brand Philosophy

DeTok은 **뉴스를 읽고 투자 기회를 발견하는 AI 서비스**이다.
증권사처럼 무겁지 않고, 토스처럼 친근하지만, AI 기반 데이터 서비스답게 똑똑한 이미지.

키워드: Smart · Simple · Calm · Fast · Trust · Insight

레퍼런스: 토스, Arc Browser, Linear, Raycast, Perplexity
(여백 많음 · 색 절제 · 단순함 · 곡선 · 과하지 않은 입체감)

## Color

가격이 아닌 **정보(News)** 중심 서비스이므로 감정적인 색(고채도 빨강/초록)을 브랜드 컬러로 쓰지 않는다.
메인은 Blue + Violet — 신뢰, AI, 데이터, 미래지향성.

| 토큰 | 값 | 용도 |
|---|---|---|
| Primary Blue | `#5B5CFF` | 브랜드 상징, 모든 CTA 버튼 기본 |
| Soft Violet | `#9D86FF` | 그래프, 선택 상태, 배경 포인트, Gradient 시작색 |
| Sky Indigo | `#7B8CFF` | Hover, 아이콘, Tag, Badge |
| White | `#FFFFFF` | 기본 배경 |
| Soft Gray | `#F7F8FC` | Section, Card Background |
| Surface | `#F2F4FF` | 선택된 Card, Input, Hover |
| Text Primary | `#171923` | |
| Text Secondary | `#6B7280` | |
| Text Disabled | `#B8BEC9` | |
| Border | `#E8EBF5` | 얇은 Border만 사용. 진한 Border 금지 |
| Success | `#22C55E` | 수익, 긍정, 완료 |
| Danger | `#EF4444` | 하락, 오류, 삭제 |
| Warning | `#F59E0B` | 주의, 시장 경고 |

### Gradient (브랜드 아이콘·로고·Hero·핵심 CTA 전용, 일반 버튼 금지)

```css
linear-gradient(135deg, #A882FF 0%, #7F8CFF 45%, #5B5CFF 100%)
/* 또는 */
linear-gradient(135deg, #9D86FF 0%, #6E79FF 100%)
```

### Color Ratio
White 70% · Blue 20% · Purple 10% — 항상 White가 가장 많아야 한다.

## Button

| 종류 | 배경 | 텍스트 | Hover | Pressed |
|---|---|---|---|---|
| Primary | `#5B5CFF` | White | `#4B4CFF` | `#3E40F7` |
| Secondary | `#F2F4FF` | `#5B5CFF` | | |
| Ghost | transparent | | `#F7F8FC` | |

## Card

- Background `#FFFFFF`, Radius `20px`
- Shadow `0 8px 30px rgba(40,50,90,.06)`

## Charts

상승 `#22C55E` · 하락 `#EF4444` · 평균선 `#7B8CFF` · 뉴스 AI 추천 `#5B5CFF` · 시장지수 `#64748B`

## App Icon

배경 `#FFFFFF` 또는 `linear-gradient(180deg,#FFFFFF,#F6F8FF)` /
아이콘 Gradient `#A882FF → #5B5CFF` / Shadow `rgba(91,92,255,0.12)` /
원본: [brand/logo.png](brand/logo.png)

## What NOT To Do

- ❌ Mint 계열 사용 금지
- ❌ Neon Color 사용 금지
- ❌ 채도 높은 빨강/초록을 브랜드 컬러로 사용 금지
- ❌ 검정 배경 위주의 UI 금지 (다크 모드는 딥 네이비 계열로, 순수 검정 배경 금지)
- ❌ 3개 이상의 브랜드 컬러 혼용 금지

## Brand Impression

믿을 수 있다 · 똑똑하다 · 군더더기가 없다 · AI가 분석해준다 · 토스처럼 쉽다 · 매일 열어보고 싶다

> "뉴스를 읽는 가장 스마트한 방법"

## 테마 정책 (앱 구현)

- 라이트 / 다크 / 시스템 3모드 지원. 기본값은 시스템.
- 다크 모드도 Blue+Violet 아이덴티티를 유지하되, 배경은 순수 검정이 아닌 딥 네이비 계열을 쓴다.
- 아이콘은 lucide 아이콘 세트를 사용한다 (`lucide-react-native`).
