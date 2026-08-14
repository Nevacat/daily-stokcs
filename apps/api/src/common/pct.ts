/**
 * from 대비 to의 등락률(%) — 소수 둘째 자리 반올림. 계산 불가면 null.
 * 히스토리 적중률과 모의 포트폴리오가 같은 반올림 규칙을 쓰도록 한 곳에 둔다.
 */
export function changePct(
  from: number | null,
  to: number | null,
): number | null {
  if (from === null || to === null || from <= 0) return null;
  return Math.round(((to - from) / from) * 10000) / 100;
}
