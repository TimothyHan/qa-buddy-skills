# 자기 개선 프로토콜: 프로젝트 학습 레이어
<!-- qab: scope=improve,setup tier=must -->

<!--
  정본: QABuddy core/references/self-improve.md (en).
  이 파일은 한국어 대응본 — 정본과 동기화를 유지할 것.
  이 프로토콜이 관리하는 LEARNINGS.md는 사용자 프로젝트 콘텐츠입니다:
  이중 로케일 대상이 아니며 QABuddy와 함께 배포되지 않습니다.
-->

QABuddy는 완성품이 아니라 파운데이션입니다. 모든 프로젝트가 무언가를 가르칩니다 —
앱의 특이점, 팀의 컨벤션, 현실 앞에서 깨진 규칙. 이 프로토콜은 모든 스킬 실행이
그 학습을 **읽고** 새 학습을 **포착하는** 방법을 정의합니다. 같은 파운데이션을
설치해도 시간이 지나면 각 팀에 맞게 서로 다르게 진화합니다.

두 레이어, 한 방향의 흐름:

| 레이어 | 위치 | 내용 | 변경 주체 |
|---|---|---|---|
| **레퍼런스** (정본) | QABuddy 설치 (`references/`) | 폭넓게 검증된 규칙 | QABuddy 업그레이드, `/qa-improve` 승격 |
| **학습** (프로젝트) | 사용자 저장소 (`features-kb/LEARNINGS.md`) | 프로젝트 고유의 델타 | 모든 스킬 실행(포착), `/qa-improve` 정제 |

흐름: 학습이 반복적으로 증명됨 → `/qa-improve` 정제(distill)가 레퍼런스로 승격
(업스트림 PR 포함 가능). 학습 레이어는 정본으로 가는 대기소입니다.

## 학습 파일
<!-- qab: id=learnings-file -->

기본 `features-kb/LEARNINGS.md`; `.qabuddy.json`의 `learningsPath`로 변경 가능.
프로젝트 저장소에 커밋됩니다 — 학습은 팀 지식이며 git으로 전파됩니다.

항목 템플릿 (학습 하나당 `##` 블록 하나):

```markdown
## LRN-20260807-01: 장바구니 사전 조건은 API로 시딩
- **Status:** active            <!-- active | promoted | retired -->
- **Scope:** test-cases, e2e-write   <!-- 적용 스킬, 또는 `all` -->
- **Statement:** 장바구니 상태는 세션 토큰과 함께 `POST /api/cart`로 시딩.
  테스트에서 UI 클릭으로 장바구니 담기 금지 — 이 앱에서는 플레이키.
- **Overrides:** REF-playwright-patterns#must-rules (확장: API 우선, 엔드포인트 추가)
- **Evidence:** 2026-08-07 /qa-test-cases 실행 — SDT가 초안 수정; UI 시딩이
  스프린트 14에서 플레이키한 체크아웃 스펙의 원인이었음.
- **Fingerprint:** ffp-a3f9c21b0e44   <!-- 선택: 이 규칙이 막는 실패 클래스 -->
- **Profile:** surface=web            <!-- 선택: Scope보다 좁힘; AND 결합 -->
```

ID 형식은 `LRN-YYYYMMDD-NN` (생성일 + 순번). ID는 영구적 — 은퇴 후에도 재사용 금지.
`Overrides:`는 이 학습이 무엇을 확장·대체하는지 가리킵니다: 레퍼런스 섹션 id
(`REF-…`, 아래), 스킬 규칙(`SKILL:test-cases "…"`), 또는 `없음`. `Fingerprint:`와
`Profile:`은 선택이며 기계가 읽습니다 (지문과 프로파일은 RFC 0001의 이후 단계에서 정의).

## 소스 ID
<!-- qab: id=source-ids -->

모든 레퍼런스 섹션은 학습처럼 주소를 갖는 **소스**입니다:

- **Id 형식:** `REF-<file-stem>#<id>`; `playbook/` 아래는 `REF-playbook/<stem>#<id>`.
  예: `REF-playwright-patterns#never`, `REF-playbook/risk-and-priority#severity-scale`.
- **위치:** 제목 바로 다음 줄의 HTML 주석 — `## Selectors` / `<!-- qab: id=selectors tier=must -->`.
  제목 텍스트에는 절대 넣지 않습니다. 코드 펜스 밖의 `##` 제목이 주소를 가지며, H1
  주석에는 섹션이 상속하는 파일 기본값(`scope=`, `tier=`)과, 지식이 H1 바로 아래
  있는 파일을 위한 `id=`를 둘 수 있습니다.
- **scope** = 쉼표로 구분한 스킬 이름 또는 `all`(기본). **tier** = `must`(스코프된
  스킬의 슬라이스에 항상 포함 — 레일, NEVER 목록, 스킬이 구조적으로 의존하는 템플릿)
  | `should`(기본) | `context`.
- **Id는 영구적.** 제목은 자유롭게 바꾸되 id는 바꾸지 않습니다. 한국어 쌍둥이는
  `qab:` 주석을 그대로 복사합니다 — 빌드는 중복 id나 en/ko id 집합 불일치에
  실패하고, 도구용 `references/index.json`(id → 파일, 제목, scope, tier, 줄 수)을
  배포합니다.
- **학습처럼 인용하세요.** 섹션이 출력을 결정하면 `LRN-…`을 인용하듯 id를 인용합니다
  (`REF-` id의 로그 의무는 RFC 0001 PR4에서 도입).

## 읽기 프로토콜 (모든 스킬 실행 시작 시)
<!-- qab: id=read-protocol -->

1. 레퍼런스를 읽은 후 학습 파일을 읽습니다 (없으면 조용히 건너뜀).
2. **Scope**에 현재 스킬(또는 `all`)이 포함되고 **Status**가 `active`인 항목만
   적용합니다. `retired` 항목은 완전히 무시; `promoted` 항목은 이미 레퍼런스에
   있으므로 이중 적용 금지.
3. **충돌 시 학습이 이깁니다.** 더 최신이고 프로젝트 특화이기 때문입니다;
   레퍼런스는 그 외 모든 곳에서 기본값으로 유지됩니다.
4. **적용한 것은 인용하고 — 로그하세요.** 학습이 출력을 결정했으면 보고서에
   ID를 명시하고 (예: "LRN-20260807-01에 따라 `data-test` 사용") **또한**
   `qab.js log applied LRN-…`를 실행하세요 (아래 *학습 로그* 참조). 인용이 이
   레이어를 감사 가능하게 만들고 — 조용한 적용은 드리프트로 보입니다 — 로그가
   셀 수 있게 만듭니다.
5. active 학습이 **실행 중 관찰한 현실과 모순되면** 적용하지 마세요.
   `qab.js log contradicted LRN-… --note "<관찰한 것>"`을 실행하고, 보고서에
   반증 증거로 플래그하고 `/qa-improve` 정제를 제안하세요. 관찰된 현실은 기록된
   학습보다 우선합니다 — 레퍼런스보다 우선하는 것과 같은 원리입니다.

## 포착 프로토콜 (모든 스킬 실행 종료 시)
<!-- qab: id=capture-protocol -->

질문: 정확히 세 가지 트리거 중 하나가 발생했는가?

1. **문서화된 규칙이 현실 앞에서 깨짐** — 레퍼런스나 학습이 X라 했는데
   앱/환경이 명백히 Y로 동작.
2. **문서화되지 않은 결정을 내림** — 어떤 레퍼런스도 다루지 않는 갈림길을
   만났고, 그 선택이 이번 실행 너머로 중요함.
3. **SDT가 출력을 수정함** — 그 수정이 일회성 취향이 아니라 프로젝트 지식을
   담고 있음.

아무것도 발생하지 않았다면: **아무것도 쓰지 말고, 아무 말도 하지 마세요.**
깨끗한 실행은 흔적을 남기지 않습니다 — 노이즈가 이 파일의 신뢰를 죽입니다.

발생했다면 항목을 추가합니다:

- **증거는 필수** — 실패한 명령, 관찰된 동작, 또는 인용된 수정 내용과 날짜.
  증거 없는 학습은 추측입니다; 기록하지 마세요.
- **델타만, 복사 금지.** 항목은 이 프로젝트가 정본과 *어떻게 다르거나 확장하는지*를
  기술합니다 (**Overrides** 필드 사용). 레퍼런스 내용을 학습에 붙여넣지 마세요 —
  오래된 포크가 갱신된 정본을 조용히 가리는 것이 바로 이 레이어가 막으려는 실패입니다.
- **항목당 사실 하나.** 한 실행에서 학습 둘 = 항목 둘.
- 보고서에 포착을 언급: "LRN-{id} 포착: {한 줄 요약}." 그리고
  `qab.js log captured LRN-{id}`를 실행하세요.

### 포착 금지 대상

- **QABuddy 자체의 결함** -- 깨진 규칙이 이 프로젝트만이 아니라 *어디서나* 틀린
  것이면, 프로젝트 델타가 아니라 스킬/레퍼런스 버그입니다. 대신 **Next steps**에
  증거와 함께 "`/qa-improve` 실행"을 제안하세요.
- 레퍼런스에 이미 있는 내용 (그건 델타가 아니라 복사)
- 재사용 가능한 규칙이 없는 일회성 환경 문제 (일시적 네트워크 플레이크)
- 세션 한정 컨텍스트 (티켓 상세, 스프린트 날짜 — KB의 역할)
- SDT가 팀 컨벤션으로 확인하지 않은 스타일 취향
- 시크릿, 자격 증명, 토큰 — 어떤 형태로든, 증거로도 금지

## 학습 로그 (읽기 경로는 쓰기 경로다)
<!-- qab: id=learnings-log -->

`LEARNINGS.md`는 학습이 *무엇을 말하는지*를 기록하고, 로그는 그 학습에 *무슨 일이
있었는지*를 기록합니다. 경로: 학습 파일 옆의 `learnings-log.jsonl` (기본
`features-kb/`). append-only, 한 줄에 JSON 객체 하나, 저장소에 커밋, 절대 제자리
편집 금지 — 리더는 모든 이전 `v`를 영원히 수용합니다.

함께 배포되는 헬퍼로 쓰고, 절대 손으로 쓰지 마세요:

```bash
node <references>/bin/qab.js run-id --skill <this-skill> [--ticket <KEY>]   # 시작 시 한 번; 실행 id 출력
node <references>/bin/qab.js log applied LRN-20260807-01                    # 학습이 출력을 결정함
node <references>/bin/qab.js log contradicted LRN-… --note "<관찰한 것>"    # 실행 중 현실이 어긋남
node <references>/bin/qab.js log captured LRN-…                             # 새 항목을 추가함
node <references>/bin/qab.js log outcome --status DONE                      # 상태 블록 직전 마지막
```

`<references>`는 플랫폼의 레퍼런스 경로입니다 (정확한 명령은 프리앰블에 있음).
`run-id`는 현재 실행을 `.qa-reports/.qab-run`에 기억합니다; 스킬을 병렬로 실행할
때는 각 `log` 호출에 `--run <id>`를 넘기세요.
스키마 v1: `{"v":1,"ts":"<UTC ISO>","run":"<skill>-<ticket|branch>-<6hex>","skill":"…","event":"…","src":"LRN-…"}`
+ `note`(contradicted) 또는 `status`(outcome). 이벤트 `compiled` / `escalated`는
컴파일 단계용으로 예약. Node를 쓸 수 없으면 같은 형태를 `echo … >>`로 추가하되
`"writer":"manual"`을 넣어 정제가 비율을 보고할 수 있게 하세요.

`qab.js stats`는 로그를 소스별 카운트(`applied`, `contradicted`, `runs`,
`last_applied`)와 아래 두 계산 판정으로 바꿉니다. 스킬은 로그를 읽지 않습니다;
정제만 읽습니다.

## 라이프사이클
<!-- qab: id=lifecycle -->

`active` → 매칭되는 모든 실행에 적용.
`promoted` → 정제가 레퍼런스로 이동시킴 (업스트림 포함 가능); 어디로 갔는지
포인터와 함께 이력 보존.
`retired` → 반증되었거나 폐기됨; 한 줄 사유와 함께 보존, 절대 삭제하지 않음.
항목은 반증 가능한 진술입니다: 모순되는 증거가 나오면 은퇴시킵니다.

정제(중복 제거, 은퇴, 승격)는 `/qa-improve`의 역할입니다 — "학습 정제해줘"로
트리거하거나, 스킬이 반증된 항목을 플래그했을 때, 또는 active 항목이 ~30개를
넘었을 때 실행하세요. 정제는 `Evidence:` 산문이 아니라 로그로 계산합니다:

| 판정 | 규칙 (`qab.js stats` 기준) |
|---|---|
| **승격 후보** | `applied ≥ 3` (서로 다른 실행 `≥ 3`) ∧ `contradicted = 0` — 그 다음 사람의 판단: 이 프로젝트 밖에서도 일반화되는가? |
| **반증됨** | `contradicted ≥ 2` ∧ 마지막 모순 이후 `applied` 없음 |

## 게이트 (무엇이 라이브러리를 바꿀 수 있고, 누가)
<!-- qab: id=gates -->

1. **사람 게이트** -- 모든 상태 변경과 모든 레퍼런스 편집은 증거와 함께 제안되고,
   SDT가 승인한 뒤에만 적용됩니다.
2. **승격 eval 게이트** -- 레퍼런스로 승격되는 학습은 그 섹션 스코프의 어떤 스킬도
   퇴행시키면 안 됩니다: 편집 전후로 스코프된 각 스킬의 `tests/fixtures.json`을
   실행하고, 모든 스킬에서 `pass_after ≥ pass_before`일 때만 머지합니다. 아니면
   편집을 되돌리고, LRN은 `active`로 두고, `features-kb/LEARNINGS.rejected.md`에
   `날짜 · LRN · 대상 · 실패한 픽스처 id · 이유`를 기록합니다. 거부는 이름과 함께,
   조용히 하지 않습니다.
3. **크리틱 (`--dry-run`)** -- 전체 정제를 `features-kb/distill-proposal-<date>.md`에
   **편집 0건**으로 씁니다. 감지와 제안은 자동, 적용은 사람. `active > 30`이나
   반증 플래그를 본 실행이 제안하되, 스스로 실행하지 않습니다.
4. **금지** -- 게이트 2 밖에서 LLM이 `references/`를 쓰는 일 없음; 자동 상태 변경
   없음 (나중에 기본 꺼짐 옵트인으로 지문-반증 항목을 감사 라인과 함께 은퇴시킬 수
   있음 -- 레퍼런스 편집은 영원히 사람의 몫).
