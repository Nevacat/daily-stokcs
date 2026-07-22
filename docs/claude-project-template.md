# Claude Code 프로젝트 세팅 템플릿

새 프로젝트에 Claude Code 설정을 깔 때 이 구조를 복사해서 쓴다.

## 폴더 구조 (역할 포함)

```
project/                             # Claude Code가 읽는 프로젝트 루트
├── CLAUDE.md                        # Claude가 매번 먼저 읽는 프로젝트 설명서
├── CLAUDE.local.md                  # 나만 쓰는 개인 메모. 팀에 공유 안 됨
├── .gitignore                       # Git이 무시할 파일 목록
├── .mcp.json                        # Claude에 외부 도구(DB·API) 연결하는 설정
├── .worktreeinclude                 # 워크트리에 복사할 gitignore 파일 목록
└── .claude/                         # 이 프로젝트의 Claude 설정이 전부 모인 폴더
    ├── rules/                       # 특정 파일을 다룰 때만 적용되는 규칙들
    │   ├── testing.md               #   테스트 파일 건드릴 때만 켜지는 규칙
    │   └── api-design.md            #   백엔드 코드 건드릴 때만 켜지는 규칙
    ├── skills/                      # 자주 쓰는 작업을 저장해두고 불러 쓰는 기능
    │   └── security-review/         #   스킬 하나는 폴더 하나로 만듦
    │       ├── SKILL.md             #   스킬의 내용이 적힌 본체 파일 (이름 고정)
    │       └── checklist.md         #   스킬에 딸린 참고 파일
    ├── commands/                    # 자주 쓰는 지시를 /명령어로 줄여 쓰는 기능
    │   └── fix-issue.md             #   입력하면 깃헙 이슈를 찾아 고쳐줌
    ├── agents/                      # 특정 일만 맡는 전문 일꾼. 따로 떼서 일시킴
    │   └── code-reviewer.md         #   코드 검토만 하는 일꾼 (고치진 않음)
    ├── hooks/                       # 특정 순간에 자동으로 실행되는 스크립트 모음
    │   ├── format-on-save.sh        #   코드 수정하면 자동으로 보기 좋게 정리
    │   └── block-secrets.sh         #   위험한 명령(rm -rf 등)·시크릿을 자동으로 막음
    ├── output-styles/               # Claude의 답변 형식·말투를 바꾸는 설정
    │   └── teaching.md              #   설명을 더 붙여서 알려주는 형식
    ├── workflows/                   # 여러 일꾼을 순서대로 자동으로 굴리는 스크립트
    │   └── <name>.js                #   /workflows에서 저장. 각 파일이 /명령어가 됨
    ├── agent-memory/                # 일꾼이 알게 된 걸 기억해두는 공간 (자동생성)
    │   └── <agent>/MEMORY.md        #   일꾼이 스스로 쓰고 갱신 (이름 고정)
    ├── settings.json                # 권한·훅·상태줄·모델·환경변수 (6개 키)
    └── settings.local.json          # 나만 쓰는 설정 오버라이드 (자동 gitignore)
```

## 파일별 요점

| 파일 | 커밋 | 역할 |
|---|---|---|
| `CLAUDE.md` | O | Claude가 매 세션 먼저 읽는 프로젝트 설명서. `@경로`로 rules 문서 참조 가능 |
| `CLAUDE.local.md` | X | 나만 쓰는 개인 메모. .gitignore에 추가 |
| `.mcp.json` | O | 외부 도구(DB·API) 연결. `{ "mcpServers": { ... } }` 형태 |
| `.worktreeinclude` | O | worktree 생성 시 복사할 gitignore된 파일 목록 (.env 등) |
| `rules/*.md` | O | frontmatter의 `paths:` 글롭에 해당하는 파일을 다룰 때만 적용되는 규칙 |
| `skills/<name>/SKILL.md` | O | 자주 쓰는 작업 절차. frontmatter `name`, `description` 필수 (description이 트리거 조건) |
| `commands/<name>.md` | O | `/name` 슬래시 명령어. `$ARGUMENTS`로 인자 치환 |
| `agents/<name>.md` | O | 전문 서브에이전트. frontmatter `name`, `description`, `tools` |
| `hooks/*.sh` | O | 특정 순간(PreToolUse/PostToolUse 등)에 자동 실행. stdin으로 이벤트 JSON 수신, exit 2로 차단. `chmod +x` 필수 |
| `output-styles/*.md` | O | 답변 형식·말투 변경. frontmatter `name`, `description` |
| `workflows/*.js` | O | 멀티 에이전트 오케스트레이션 스크립트. `export const meta`로 시작 |
| `agent-memory/<agent>/MEMORY.md` | X | 에이전트가 스스로 쓰고 갱신하는 메모리 (자동생성) |
| `settings.json` | O | permissions·hooks·statusLine·model·env 등 공유 설정 |
| `settings.local.json` | X | 개인 설정 오버라이드 (자동 gitignore) |

## 새 프로젝트에 적용하는 법

1. 이 구조대로 폴더/파일 복사
2. `CLAUDE.md`, `rules/` 내용을 그 프로젝트에 맞게 수정
3. `chmod +x .claude/hooks/*.sh`
4. `.gitignore`에 다음 4줄 확인:
   ```
   CLAUDE.local.md
   .claude/settings.local.json
   .claude/agent-memory/
   .env
   ```

## 빈 폴더 한 번에 만들기 (셸)

```bash
mkdir -p .claude/{rules,commands,hooks,output-styles,workflows} \
         .claude/skills/security-review \
         .claude/agents \
         .claude/agent-memory
touch CLAUDE.md CLAUDE.local.md .gitignore .mcp.json .worktreeinclude \
      .claude/settings.json .claude/settings.local.json
```
