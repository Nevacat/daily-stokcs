// 예시 워크플로: 변경 코드를 여러 관점으로 병렬 리뷰 후 검증
export const meta = {
  name: 'review-changes',
  description: '변경된 코드를 버그/보안/성능 관점으로 병렬 리뷰하고 검증한다',
  phases: [
    { title: 'Review', detail: '관점별 병렬 리뷰' },
    { title: 'Verify', detail: '발견 사항 재검증' },
  ],
}

const DIMENSIONS = [
  { key: 'bugs', prompt: 'git diff의 변경 코드에서 버그와 엣지 케이스 누락을 찾아라.' },
  { key: 'security', prompt: 'git diff의 변경 코드에서 보안 문제(시크릿, 인젝션, 검증 누락)를 찾아라.' },
  { key: 'perf', prompt: 'git diff의 변경 코드에서 성능 문제(불필요한 반복 호출, N+1)를 찾아라.' },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          title: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['file', 'title', 'detail'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { isReal: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['isReal', 'reason'],
}

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS }),
  review => parallel(review.findings.map(f => () =>
    agent(`다음 리뷰 지적이 실제 문제인지 코드를 직접 확인해 판정하라: ${f.file} — ${f.title}: ${f.detail}`,
      { label: `verify:${f.file}`, phase: 'Verify', schema: VERDICT })
      .then(v => ({ ...f, verdict: v }))
  ))
)

const confirmed = results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
return { confirmed }
