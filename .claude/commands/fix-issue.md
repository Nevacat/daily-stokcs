---
description: GitHub 이슈 번호를 받아 원인 분석 → 수정 → 테스트 → 커밋까지 수행
---

GitHub 이슈 #$ARGUMENTS 를 수정해줘.

절차:
1. `gh issue view $ARGUMENTS`로 이슈 내용을 확인한다.
2. 관련 코드를 찾아 원인을 분석하고, 수정 방향을 한 문단으로 먼저 보고한다.
3. 수정을 구현한다. @.claude/rules/testing.md 규칙에 따라 테스트를 추가/갱신한다.
4. 전체 테스트를 실행해 통과를 확인한다.
5. `fix: <요약> (#$ARGUMENTS)` 형식으로 커밋한다.
