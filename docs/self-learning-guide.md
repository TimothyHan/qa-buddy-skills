# 셀프러닝 & 컨텍스트 컴파일러 — 사용자 가이드

English: [self-learning-guide-en.md](self-learning-guide-en.md)

QABuddy는 "당신의 프로젝트를 학습하는 QA 파운데이션"입니다. 이 가이드는 그 문장이
실제로 무엇을 뜻하는지 설명합니다: 스킬을 실행할 때마다 **자동으로 일어나는 일**,
그 과정이 남기는 **파일들**, 그리고 당신이 **직접 조종할 수 있는 것들**입니다.

QABuddy 스킬을 쓰는 SDT를 위한 문서입니다. QABuddy 자체를 고치려면
[CONTRIBUTING.md](../CONTRIBUTING.md)를 보세요. 설계 배경이 궁금하면
[RFC 0001](rfc/0001-context-compiler.md)(컴파일러)과
[RFC 0002](rfc/0002-project-owned-compiler.md)(프로젝트 소유 설정)가 원전입니다.

---

## 1. 한눈에 보는 루프

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
  ① 컴파일 ──► ② 스킬 실행 ──► ③ 인용·로그 ──► ④ 포착 ──► ⑤ 정제
  (slice.md)    (평소의 QA)     (applied/         (LEARNINGS.md)  (distill:
                                contradicted)                     은퇴·승격)
```

1. **컴파일** — 스킬이 시작되면 `qab.js compile`이 그 스킬에 스코프된 지식만
   골라 `slice.md` 하나로 만듭니다. 레퍼런스 전체를 여는 대신 슬라이스만 읽습니다.
2. **실행** — 스킬은 평소처럼 일합니다 (테스트 계획, QA, 리뷰…).
3. **인용·로그** — 어떤 지식이 출력을 실제로 좌우하면 그 ID를 인용하고
   `applied`로 기록합니다. 현실이 지식과 모순되면 `contradicted`로 기록합니다.
4. **포착** — 실행이 끝날 때, 이 프로젝트 고유의 새 사실이 발견됐으면
   `LEARNINGS.md`에 학습으로 추가됩니다.
5. **정제** — 쌓인 로그를 근거로 `/qa-improve` distill이 중복을 병합하고,
   반증된 학습을 은퇴시키고, 증명된 학습을 승격 제안합니다.

이 루프 전체가 **증거 기반**입니다: 어떤 판단도 "느낌"이 아니라 로그의 숫자
(`applied` 몇 회, `contradicted` 몇 회, 슬라이스에 몇 번 실렸는지)에서 나옵니다.

---

## 2. 지식의 세 층

| 층 | ID 접두사 | 소유 | 어디 사는가 | 업데이트 후 생존 |
|---|---|---|---|---|
| 배포 레퍼런스 | `REF-` | QABuddy | 설치된 `references/` | 덮어써짐 (업스트림이 관리) |
| **프로젝트 레퍼런스** | `PRJ-` | **당신 팀** | 당신 저장소 (`compiler.references`) | ✅ |
| **학습** | `LRN-` | **당신 프로젝트** | `features-kb/LEARNINGS.md` | ✅ |

- **`REF-`** — QABuddy가 배포하는 방법론 (심각도 척도, Playwright 패턴, 결함
  라이프사이클…). 섹션마다 어떤 스킬이 받을지(`scope`)와 중요도(`tier`)가 붙어 있습니다.
- **`PRJ-`** — 팀이 직접 작성한, 안정적인 방법론 ("우리는 결제를 이렇게 테스트한다").
  §6.2에서 만드는 법을 다룹니다.
- **`LRN-`** — 실행 중 실제로 관찰되어 쌓인 사실 ("이 앱의 에러 배너에는 role
  속성이 없다"). 증거와 수명이 있고, **충돌하면 학습이 레퍼런스를 이깁니다** —
  당신 프로젝트에서 관찰된 사실이 일반론보다 우선입니다.

`PRJ-`와 `LRN-`의 구분이 중요합니다: 학습은 *축적된 증거*라서 수명이 있고
(은퇴·승격), 팀 플레이북은 *저술된 방법론*이라서 안정적입니다. 플레이북을
학습으로 밀어 넣으면 distill이 "적용 횟수가 없다"며 계속 은퇴를 제안하게 됩니다.

---

## 3. 스킬 실행마다 자동으로 일어나는 일

당신이 따로 할 일은 없습니다 — 스킬 프리앰블이 아래를 수행합니다. 다만 무엇이
어디에 남는지 알면 나중에 되짚을 수 있습니다.

### 3.1 컴파일과 슬라이스

```bash
node $QAB compile --skill qa --ticket PROJ-123
```

이 한 줄이:

- 실행(run) 디렉터리를 만들고 (`.qa-reports/runs/<run>/`)
- 후보를 고르고 — `scope`가 이 스킬을 지명하는 `REF-`/`PRJ-` 섹션
  (+ `all` 스코프의 `tier=must`) ∪ 이 스킬에 스코프된 `active` 학습
- `slice.md`로 패킹합니다 — `must` 먼저, 각 학습은 자기가 오버라이드하는 섹션 바로 뒤

실행 디렉터리에 남는 것:

| 파일 | 내용 |
|---|---|
| `slice.md` | 매니페스트 + 지식 본문 (스킬이 실제로 읽은 전부) |
| `profile.json` | 실행 프로파일 (surface, pom, ticket_kind)과 그 해시 `pfp` |
| `scratchpad.md` | 스킬의 작업 메모 — `## Candidate learnings`가 포착 후보를 모음 |
| `events.jsonl` | 이 실행의 로그 이벤트 사본 |

### 3.2 매니페스트 읽는 법

`slice.md` 맨 위의 매니페스트는 "왜 이 지식이 들어갔고 저 지식이 빠졌는지"를
설명합니다:

```yaml
---
manifest: 1
run: qa-PROJ-123-3f9a2c
skill: qa
pfp: 5408a28cb4ac
sources:
  - id: REF-playbook/risk-and-priority#severity-scale   tier: must   lines: 18
  - id: PRJ-payments#seed-rules   tier: should   lines: 4   via: project-override
  - id: LRN-20260817-05   tier: lrn   lines: 3
dropped:
  - id: REF-feature-knowledge-base-spec#problem   reason: general-scope
  - id: LRN-20260801-03   reason: profile
  - id: REF-playbook/defect-lifecycle#not-reproducible   reason: project-override
---
```

| 표기 | 뜻 |
|---|---|
| `via: project-override` | 당신의 `compiler.scope` 설정 **때문에** 들어온 섹션 |
| `reason: project-override` | 당신의 설정이 뺀 섹션 |
| `reason: general-scope` | `all` 스코프인데 `must`가 아니라서 안 실림 (일반 컨텍스트) |
| `reason: profile` | 학습의 `Profile:` 조건이 이 실행과 안 맞음 (예: api 전용 학습, web 실행) |

슬라이스는 항상 스스로를 설명합니다 — "왜 이게 여기 있지?"의 답은 매니페스트에 있습니다.

### 3.3 인용과 로그 — 루프의 연료

스킬이 심각도를 척도표에서 읽었거나 셀렉터 규칙을 따랐다면, 그 섹션 ID를
인용하고 기록합니다:

```bash
node $QAB log applied REF-playbook/risk-and-priority#severity-scale
node $QAB log contradicted LRN-20260808-04 --note "관찰: 스크립트가 --prefix를 씀"
```

이 로그(`features-kb/learnings-log.jsonl`, append-only, 커밋됨)가 시스템 전체의
**단일 증거원**입니다. distill의 은퇴/승격 판단도, §6.3의 게이트도 전부 이
로그를 읽습니다. 오타 낸 ID는 거부되고 가장 가까운 ID를 제안받으므로, 틀린
인용이 로그에 들어가지 않습니다.

실패가 나면 **실패 클래스 지문**도 남습니다:

```bash
node $QAB fp locator-not-found "checkout/place-order-btn"
```

같은 클래스의 실패는 실행이 달라도 같은 지문(`ffp`)으로 해시됩니다. 어떤 학습이
"이 실패를 막는다"고 주장했는데 그 지문이 다시 찍히면 — 그게 자동 반증 증거입니다.

### 3.4 포착 — 학습이 태어나는 곳

실행을 닫기 전에 스킬은 스크래치패드의 후보들에 세 가지 트리거를 적용합니다:

1. 문서화된 규칙이 현실 앞에서 깨졌다
2. 문서화되지 않은 결정을 내렸다
3. SDT가 프로젝트 지식이 담긴 수정을 했다

하나라도 발화하면 증거가 담긴 `LRN-` 항목이 `LEARNINGS.md`에 추가됩니다.
발화하지 않으면 아무것도 쓰지 않습니다 — 학습 파일은 잡동사니 메모장이 아닙니다.

---

## 4. 층의 유지보수 — stats와 distill

### 4.1 현황 보기

```bash
node $QAB stats
```

소스별로 `in_slice`(슬라이스에 실린 횟수) · `applied` · `contradicted` ·
`runs` · `last_applied`를 표로 보여주고, 계산된 발견을 라벨로 답니다:

| 라벨 | 계산 근거 | 뜻 |
|---|---|---|
| `promotion candidate` | applied ≥ 3, runs ≥ 3, 모순 0, 지문 무반응 | 증명됨 — 정본 승격 후보 |
| `falsified (contradiction)` | contradicted ≥ 2, 이후 applied 없음 | 현실이 두 번 반박함 |
| `falsified (fingerprint …)` | 막는다던 실패 클래스가 재발 | 자동 반증 |
| `never applied (in_slice N)` | 10회 이상 실렸는데 적용 0 | 휴면 — §6.1의 후보 |
| `duplicate (fingerprint) of …` | 같은 지문 ∧ 같은 스코프 | 중복 |

### 4.2 정제 (distill)

스킬이 반증 플래그를 세우거나 active 학습이 ~30개를 넘으면 `/qa-improve`
distill을 돌릴 때입니다. distill은 위 계산 열을 근거로 **제안만** 하고, 적용은
항상 당신의 승인을 거칩니다:

- **병합** — 같은 사실을 말하는 두 항목
- **은퇴** — 반증되었거나 오래 휴면인 학습 (삭제가 아니라 상태 변경 — 이력은 영구)
- **승격** — 증명되고 일반화 가능한 학습을 레퍼런스 정본으로 (eval 게이트 통과 시에만)

`--dry-run`을 붙이면 제안 파일만 쓰고 아무것도 편집하지 않습니다.

---

## 5. 왜 이 모든 게 필요한가 — 한 문단 요약

RFC 0001은 이 루프를 만들고 나서 스스로에게 물었습니다: "이제 로그가 있으니,
자주 적용되는 지식을 우선하는 **점수화**를 켤까?" 측정의 답은 **아니오**였습니다 —
28회 실행에서 한 번도 적용되지 않은 18개 섹션 중 **선택이 잘못돼서** 휴면인 것은
0개였고, 필요한 감축은 스코프 정리로 결정론적으로 달성됐습니다. 단, 그것은 *한
프로젝트의 데이터*에 대한 판정입니다. 그래서 RFC 0002는 그 판단 도구 자체를
당신에게 줍니다: 스코프를 직접 고치고(§6.1), 팀 지식을 넣고(§6.2), **당신의
데이터가** 점수화를 정당화하는지 직접 재는(§6.3) 능력입니다.

---

## 6. 컴파일러를 소유하기 — `.qabuddy.json`

여기부터가 RFC 0002입니다. 셋 다 **opt-in**이며, 설정하지 않으면 아무 동작도
바뀌지 않습니다. 설정 파일은 프로젝트와 함께 버전 관리되고 PR로 리뷰할 수
있으며, QABuddy를 업데이트해도 살아남습니다 — 배포 파일을 고치는 것과의 차이가
바로 이것입니다.

### 6.1 스코프 오버라이드 — `compiler.scope`

어떤 섹션이 어떤 스킬의 슬라이스에 실릴지 프로젝트 단위로 바꿉니다:

```jsonc
// .qabuddy.json
{
  "compiler": {
    "scope": {
      "REF-playbook/maintenance-and-ci#ci-cd-pipeline": { "remove": ["qa"] },
      "REF-playbook/exploratory-heuristics#techniques-per-heuristic": { "add": ["test-cases"] }
    }
  }
}
```

유효 스코프 = (원래 스코프 − remove) ∪ add. 코어 해석 **이후**에 적용되므로
업스트림이 기본 스코프를 바꿔도 그대로 흘러들어옵니다.

**규칙 — 전부 시끄럽게 실패합니다:**

- **`tier=must`는 바닥값입니다.** must 섹션에 `remove`를 걸면 컴파일이 이름 붙은
  오류로 거부합니다. 레일은 레일로 남습니다.
- **모르는 ID는 거부됩니다** — 가장 가까운 ID를 제안하면서. 조용히 죽은
  오버라이드("설정했다고 믿는데 실은 무시됨")는 오류보다 나쁩니다.
- **모든 오버라이드가 매니페스트에 보입니다** (`via:`/`reason: project-override`, §3.2).

**언제 쓰나:** `stats`가 어떤 섹션을 `never applied`로 보여주는데, 그 이유를
직접 판단해 보니 "우리 도메인에는 발화할 수 없는 지식"일 때. 반대로, 다른
스킬에 스코프된 섹션이 우리 팀 워크플로우에서는 이 스킬에도 필요할 때 `add`.

### 6.2 프로젝트 레퍼런스 섹션 — `compiler.references`

팀의 방법론 파일을 배포 레퍼런스와 똑같은 자격으로 컴파일 대상에 넣습니다:

```jsonc
{ "compiler": { "references": ["features-kb/house/*.md"] } }
```

파일은 배포 레퍼런스와 **같은 규약**을 씁니다 — 제목 밑 줄의 `qab:` 주석:

```markdown
# Payments testing
<!-- qab: scope=test-cases,qa -->

## Seed rules
<!-- qab: id=seed-rules -->

결제 테스트는 샌드박스 계정 P-77로만 한다; 실제 카드는 절대 쓰지 않는다.

## Refund checks
<!-- qab: id=refund-checks scope=qa tier=must -->

환불 검증은 원장(ledger) 익스포트와 대조한다.
```

- H1의 주석은 파일 기본값(`scope=`, `tier=`), 섹션 주석이 개별 오버라이드.
- ID는 `PRJ-<파일줄기>#<id>`로 네임스페이스됩니다 (`PRJ-payments#seed-rules`) —
  배포 `REF-` ID와 충돌이 불가능하고, 로그의 인용이 누구 지식이었는지 항상 명확합니다.
- 컴파일·인용·`stats` 집계·distill 리뷰까지 전부 `REF-`와 동일하게 참여합니다.
- 깨진 파일(태그 없는 `##`, 중복 ID, 같은 줄기의 두 파일)은 파일:줄을 명시하며
  컴파일이 거부됩니다. 매치되는 파일이 없는 패턴은 경고만 하고 계속합니다.

**학습이 아니라 여기에 넣어야 할 것:** 팀이 *결정한* 안정적 방법론. 실행 중
*관찰된* 사실은 여전히 학습입니다. 헷갈리면: "이게 은퇴하거나 승격될 수 있는
가설인가?" — 그렇다면 학습, 아니라면 하우스 섹션.

### 6.3 게이트 리포트 — `qab.js gate`

```bash
node $QAB gate          # 사람이 읽는 표
node $QAB gate --json   # 기계용
```

RFC 0001 §9.3의 점수화 자격 게이트를 **당신 프로젝트의 로그**로 평가합니다:

```
gate (RFC 0001 §9.3, evaluated on this project's logs — RFC 0002 §2.3):
  profiles with attributed outcomes (need ≥ 2, each ≥ 8):
    5408a28cb4ac  9 outcomes (DONE=8 DONE_WITH_CONCERNS=1)
    a80fefa0c1ba  8 outcomes (DONE=8)
  application:
    repeatedly applied (runs ≥ 3): 12 · dormant (in_slice ≥ 10 ∧ applied = 0): 3
    dormant: REF-playbook/metrics-and-coverage#code-coverage (REF)  in_slice 14
    …
  verdict: ELIGIBLE — 2 profiles carry ≥ 8 outcomes and application is uneven …
```

- **문턱**: 서로 다른 프로파일(`pfp`) ≥ 2개, 각각 outcome ≥ 8회 — 그리고 적용이
  불균등해야 합니다 (휴면 소스와 반복 적용 소스가 공존).
- 프로파일 없는 outcome 실행은 보고만 되고 절대 어느 프로파일에도 합산되지
  않습니다 (한 번 실제로 발생했던 오귀속 실수의 기계적 재발 방지).
- **이 리포트는 증거를 모을 뿐 원인을 분류하지 않습니다.** ELIGIBLE이 나와도
  마지막에 사람에게 묻습니다: 각 휴면 소스가 *발화 불가*인지, *다른 곳과
  중복*인지, *그 종류의 일이 아직 없었을 뿐*인지, *정말 선택 실패*인지. QABuddy
  자신의 데이터에서는 18개 휴면 중 선택 실패가 0개였습니다 — 도구가 원인을
  추측했다면 바로 그 판정이 경고한 오류를 재현했을 것입니다.

**게이트가 열리는 순간은 QABuddy가 먼저 알려줍니다.** 게이트를 넘기는 바로 그
outcome이 기록될 때 `log outcome`이 🔓 알림을 출력하고, 스킬이 그것을 당신에게
전달하며 점수화를 원하는지 묻습니다 — 정확히 전환되는 한 번만 울리고, 켜는 결정과
`.qabuddy.json` 편집은 언제나 사람 몫입니다.

### 6.4 점수화 켜기 — `compiler.scoring` (PR D)

한 줄 트레이드오프: **얻는 것** — 더 가벼운 실행 (이 프로젝트에서 증명된 지식이
먼저 실리고 나머지는 예산에 맞게 잘림 → 티켓 자체에 쓸 컨텍스트가 늘어남).
**감수하는 것** — 옳지만 *아직* 안 쓰였을 뿐인 지식도 잘릴 수 있음. QABuddy 자신의
측정에서는 "안 쓰인" 지식 대부분이 바로 그런 경우였습니다 — 그래서 이 결정은
도구가 아니라 사람이 내립니다.

```jsonc
{ "compiler": { "scoring": true, "budget_lines": 220 } }
```

켜면 컴파일이 **프로파일별로** 후보의 점수를 매기고 예산을 넘는 꼬리를 떨어뜨립니다:

- **바닥값은 절대 떨어지지 않습니다**: `tier=must` 섹션, 이 프로파일의 최근 3개
  실행에서 적용된 소스, 그리고 모든 학습 (프로젝트 자신의 교정은 예산의 대상이
  아닙니다). 예산이 바닥값보다 작아도 바닥값은 전부 실립니다.
- **점수는 이 프로파일의 데이터로만** 계산됩니다 (`applied_ratio × 모순 페널티 ×
  최근성 × 빈도`). 이 프로파일의 outcome이 8회 미만이면 그 컴파일은 **비점수**로
  돌아갑니다 — 전역 랭킹으로 대체하는 일은 없습니다 (§9.3이 금지한 바로 그 오류).
- **10번째 실행마다 오디션**: 예산에서 떨어진 최고 후보가 `(audition)` 표시를 달고
  실립니다 — 휴면 지식이 `applied`를 벌 기회를 계속 얻습니다.
- 매니페스트가 전부 보여줍니다: 실린 소스의 `score:`와 `n:`, 떨어진 소스의
  `reason: budget score: … n: …`.

**켜기의 규칙 (RFC 0002 §2.4):** 게이트가 자격 없음이면 컴파일이 이유를 명시하며
거부합니다. 그래도 켜려면 `"scoringOverride": "<한 줄 메모>"` — 그 메모가 로그에
**결정으로 기록**됩니다 (같은 메모당 정확히 한 번). 막혀 있는 것은 점수화가 아니라
*조용히* 켜지는 것입니다.

자동 상태 변경(E)은 아직 코드로 없습니다 — 생기면 같은 규칙을 따릅니다.

---

## 7. 레시피

**"stats에 계속 뜨는데 한 번도 안 쓰이는 섹션이 있다"**
→ `node $QAB stats`로 `never applied` 확인 → 원인을 *직접* 분류 →
발화 불가라면 `compiler.scope`로 `remove` → 다음 실행의 매니페스트에서
`reason: project-override` 확인. 그냥 "아직 그런 일을 안 했을 뿐"이라면 두세요 —
휴면은 죄가 아닙니다.

**"팀 위키에 테스트 방법론 문서가 있다"**
→ `features-kb/house/`로 옮기고 `qab:` 주석을 달고 `compiler.references`에 패턴
추가 → 다음 실행부터 해당 스킬 슬라이스에 실리고, 인용되면 `stats`에 집계됩니다.

**"점수화를 켜고 싶다"**
→ `node $QAB gate`. NOT ELIGIBLE이면 그게 답입니다 (대개 데이터가 아직 얇다는
뜻). ELIGIBLE이면 휴면 소스의 원인 분류가 먼저입니다 — 분류 결과 선택 실패가
없다면, 점수화가 고칠 문제 자체가 없는 것입니다.

**자주 보는 오류들:**

| 메시지 | 뜻 | 대처 |
|---|---|---|
| `unknown section id … did you mean:` | 오버라이드 ID 오타 (또는 업스트림 개명) | 제안된 ID로 수정 |
| `… is tier=must — a must section is a floor` | must 제거 시도 | `remove` 삭제 — 레일은 못 뺍니다 |
| `pattern "…" matched no files` | references 글롭이 빈 결과 (경고만) | 경로 확인; 파일을 나중에 만들 거면 무시 가능 |
| `"## …" has no <!-- qab: id=… -->` | 하우스 파일의 섹션에 ID 누락 | 제목 다음 줄에 주석 추가 |
| `run "…" already reported an outcome` | 닫힌 실행에 로그 시도 (보통 낡은 마커) | `run-id`로 새 실행 시작 |

---

## 8. 명령 요약

| 명령 | 하는 일 |
|---|---|
| `qab.js compile --skill <s> [--ticket <k>]` | 슬라이스 컴파일 (스킬이 자동 호출) |
| `qab.js log applied\|contradicted\|captured\|outcome …` | 증거 로그 (스킬이 자동 호출) |
| `qab.js fp <kind> "<key>"` | 실패 클래스 지문 |
| `qab.js stats [--json]` | 소스별 집계 + 계산된 발견 + 준수율 |
| `qab.js gate [--json]` | 점수화 자격 게이트 — 당신 데이터로 |
| `qab.js scoreboard` | 파생 캐시 재생성 (진실의 원천 아님) |

파일 지도: 슬라이스·프로파일·스크래치패드는 `.qa-reports/runs/<run>/`,
학습·로그·지문은 `features-kb/`, 설정은 `.qabuddy.json`
([README 설정표](../README.md#설정) 참조).
