---
name: setup
version: 0.4.2
description: |
  QABuddy 초기 설정 마법사. 컨텍스트 소스(Jira, 스펙 문서, 채팅, 커스텀),
  팀 모드(솔로 vs PR 기반), 프로젝트 환경설정을 구성합니다.
  프로젝트 루트에 .qabuddy.json을 생성합니다. 재실행하면 재구성할 수 있습니다.
  Use when: "setup", "configure", "first time setup", "change settings".
  Do NOT use when: asking about QABuddy features, asking how to use a skill, mid-workflow.
tool-groups:
  - bash
  - read
  - write
  - ask
  - grep
  - glob
preamble-tier: 1
---

# /qa-setup: QABuddy 설정

이 프로젝트에 맞게 QABuddy를 설정합니다. 프로젝트 루트에 `.qabuddy.json`을 생성하며,
다른 모든 스킬이 이 설정 파일을 읽어 동작을 조정합니다.

## 제약 조건

1. **확인 없이 덮어쓰지 않는다.** `.qabuddy.json`이 이미 있으면 현재 설정을 먼저 보여준다.
2. **저장 전에 반드시 확인한다.** 전체 설정을 보여주고 확인을 받은 뒤에 파일을 저장한다.
3. **한 번에 하나씩 질문한다.** 여러 질문을 한꺼번에 묶지 않는다.

---

## Phase 1: 기존 설정 확인

```bash
cat .qabuddy.json 2>/dev/null
```

- **설정 파일이 있는 경우:** 현재 설정을 보여주고 묻는다: "재구성하시겠습니까, 현재 설정을 유지하시겠습니까?"
  - (A) 재구성 -- Phase 2로 진행
  - (B) 유지 -- 요약을 보여주고 종료
- **설정 파일이 없는 경우:** Phase 2로 진행

---

## Phase 2: 컨텍스트 소스

SDT에게 묻는다:

"팀에서 기능에 대한 정보(에픽 상세, 인수 조건(AC), 스펙)를 어떻게 제공하나요?"

- **(A) Jira** (Atlassian을 사용 중이라면 권장) -- Atlassian MCP를 통해 티켓을 조회합니다
- **(B) 스펙 문서** -- 기능 스펙이 이 저장소에 파일로 있습니다 (예: `docs/`, `specs/`)
- **(C) 채팅** -- 필요할 때 직접 붙여넣거나 링크로 공유합니다
- **(D) 커스텀** -- 사용 방식을 직접 설명합니다

**Jira를 선택한 경우:** 프로젝트 키를 묻는다 (예: "PROJ"). Jira MCP 연결 상태를 확인한다:
```bash
# atlassian MCP 설정 여부 확인
grep -r "atlassian" ~/.claude/settings.json .claude/settings.json .claude/settings.local.json 2>/dev/null
```
MCP를 찾지 못하면 경고하되 진행을 막지는 않는다 -- SDT가 나중에 설정할 수 있다.
기능과 스토리는 Jira 키를 KB 식별자로 사용한다 (예: `PROJ-123`, `PROJ-456`).

**스펙, 채팅, 커스텀을 선택한 경우:** 이름 지정 방식을 설명한다:
"Jira를 사용하지 않으므로, 스킬 실행 시 기능과 스토리 이름을 직접 지정합니다.
짧고 설명적인 slug를 사용하세요 (예: `auth-system`, `login-page`, `pdf-export`).
이 이름이 지식 베이스(KB)의 디렉터리 이름이 됩니다:
`features-kb/features/auth-system/test-cases/login-page.md`"

**커스텀을 선택한 경우:** 해당 방법에 대한 간단한 설명도 요청한다 (설정에 저장됨).

---

## Phase 3: 팀 모드

"이 프로젝트에서 QABuddy를 여러 팀원이 사용하나요, 혼자 사용하나요?"

- **(A) 혼자 (솔로)** -- 변경 사항을 로컬에만 적용하고, PR을 생성하지 않습니다
- **(B) 팀** -- KB 변경 및 스킬 개선 시 PR을 생성합니다

**팀을 선택한 경우:** `gh` CLI를 확인한다:
```bash
gh --version 2>/dev/null
```
사용할 수 없으면 경고한다: "GitHub CLI가 설치되어 있지 않습니다. PR 워크플로우를 사용하려면 설치하거나, 솔로 모드로 전환하세요."

---

## Phase 3b: 업스트림 기여 (선택)

"QABuddy 커뮤니티에 스킬 개선 사항을 기여하시겠습니까?
`/qa-improve`로 스킬을 수정하면 업스트림 QABuddy 저장소에 PR을 보낼 수 있습니다.
범용적인 개선만 해당하며, 팀 고유 변경은 포함되지 않습니다."

- **(A) 예** -- 업스트림 기여를 활성화합니다
- **(B) 아니오** -- 개선 사항을 로컬 또는 팀 내에서만 유지합니다

**예를 선택한 경우:** `gh` CLI가 필요하다 (팀 모드 선택 시 Phase 3에서 이미 확인됨). 업스트림 저장소 URL을 저장한다.

---

## Phase 4: 설정 저장

응답 내용을 바탕으로 설정 객체를 구성한다:

```json
{
  "version": "1.0",
  "contextSource": "{jira|spec|chat|custom}",
  "teamMode": "{solo|team}",
  "jiraProject": "{PROJ or null}",
  "customContextMethod": "{description or null}",
  "githubCli": true/false,
  "contributeUpstream": true/false,
  "learningsPath": "features-kb/LEARNINGS.md",
  "upstreamRepo": "TimothyHan/qa-buddy-skills",
  "defaultBranch": "main",
  "createdAt": "{ISO timestamp}"
}
```

기본 브랜치를 감지한다:
```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

SDT에게 전체 설정을 보여준다: "설정 내용입니다. 저장하시겠습니까?"
- **(A) 저장** -- `.qabuddy.json`을 작성한다
- **(B) 수정** -- 해당 질문으로 돌아간다

---

## Phase 4b: 학습 레이어 초기화

`learningsPath` 위치에 파일이 없으면 생성한다 (질문 불필요 -- 모든 프로젝트가
하나씩 가진다; 프로토콜은 `{{REFERENCE_PATH}}/self-improve.md` 참조):

```markdown
# Project Learnings

QABuddy가 실제 실행에서 포착한 프로젝트 고유 규칙. 모든 스킬이 시작 시 이 파일을
읽고 (`active` 항목이 레퍼런스를 오버라이드), 실행이 새로운 것을 가르치면 증거가
담긴 항목을 추가합니다. 프로토콜: references/self-improve.md.
항목 형식 -- `## LRN-YYYYMMDD-NN: 제목` + **Status** (active|promoted|retired),
**Scope**, **Statement**, **Overrides**, **Evidence**.

<!-- 아직 항목 없음. 프로젝트가 가르치는 대로 스킬이 아래에 추가합니다. -->
```

SDT에게 안내한다: "`{learningsPath}`를 생성했습니다 -- QABuddy는 모든 스킬 실행에서
학습을 포착해 이 프로젝트에 맞게 진화합니다. 팀 지식이니 커밋하세요."

---

## Phase 5: 팀 실무 관행 (선택)

"팀에서 다음 항목에 대한 절차가 정의되어 있나요? (해당하는 항목을 모두 선택하세요)"
- [ ] 버그 분류 / 접수 절차
- [ ] 핫픽스 테스트 워크플로우
- [ ] 테스트 데이터 관리 (시딩, 정리, fixture)
- [ ] 릴리스 워크플로우 (동결, 롤백, 마감)
- [ ] 접근성 요구사항 (WCAG 레벨, 도구)
- [ ] 아직 없음

**선택한 항목이 있는 경우:** "해당 내용을 붙여넣거나, 파일 경로를 알려주거나, 간단히 설명해 주세요. 저장해 두면 모든 스킬이 이 내용을 따릅니다."

각 항목을 `features-kb/team-practices/`에 저장한다:
```bash
mkdir -p features-kb/team-practices
```

| 실무 관행 | 저장 경로 | 사용하는 스킬 |
|----------|----------|-------------|
| 버그 분류 | `features-kb/team-practices/bug-triage.md` | `/qa-qa`, `/qa-sprint-status` |
| 핫픽스 테스트 | `features-kb/team-practices/hotfix-testing.md` | `/qa-qa`, `/qa-verify-fix` |
| 테스트 데이터 | `features-kb/team-practices/test-data.md` | `/qa-qa`, `/qa-test-cases`, `/qa-exploratory` |
| 릴리스 워크플로우 | `features-kb/team-practices/release-workflow.md` | `/qa-sprint-status` |
| 접근성 | `features-kb/team-practices/accessibility.md` | `/qa-qa`, `/qa-test-cases`, `/qa-exploratory` |

**"아직 없음"을 선택한 경우:** "괜찮습니다. 각 스킬이 필요할 때 개별적으로 물어봅니다. 나중에 `/qa-setup`을 다시 실행하면 팀 실무 관행을 추가할 수 있습니다."

---

## Phase 6: 다음 단계

저장 후:

"이 프로젝트의 QABuddy 설정이 완료되었습니다.

설정 요약:
- 컨텍스트 소스: {source}
- 팀 모드: {mode}
- {Jira 프로젝트 / 스펙 위치 / 커스텀 방식}
- 팀 실무 관행: {N}개 문서화 완료, {M}개 미정의
- 학습 레이어: {learningsPath} (모든 스킬 실행에서 자기 개선 활성)

다음: `/qa-start {EPIC-KEY 또는 기능 설명}`을 실행하여 가이드 워크플로우를 시작하세요.
또는 개별 스킬을 직접 사용할 수 있습니다: `/qa-test-plan`, `/qa-review-ticket` 등"

**Status:** DONE
**Summary:** QABuddy 설정 완료 -- .qabuddy.json 생성됨
**Next steps:** /qa-start를 실행하여 가이드 워크플로우를 시작하세요
