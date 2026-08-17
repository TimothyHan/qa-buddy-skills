# 기능 지식 베이스(KB) 명세
<!-- qab: scope=all -->

기능 지식 베이스(Knowledge Base, KB)는 기능 컨텍스트를 가공하여 저장하는
구조화된 저장소입니다. 팀이 작업하는 모든 기능에 대해 통합된 AI 친화적 요약을
저장하여, Jira/Confluence에 동일한 질의를 반복하지 않도록 합니다.

**Version:** 0.2.0
**Last updated:** 2026-04-02
**Status:** Spec -- 아직 구현 전

---

## 1. 문제
<!-- qab: id=problem -->

스킬이 특정 기능을 이해해야 할 때마다 Jira(에픽, 스토리, 태스크, 댓글),
Confluence(PRD, 설계 문서), 경우에 따라 Figma까지 조회합니다. 이 방식에는
다음과 같은 문제가 있습니다.

- **느림:** 기능 하나당, 스킬 호출마다 5-10회의 API 호출이 필요합니다.
- **비용 과다:** 토큰 소모가 큽니다. 동일한 기능 정보를 `/test-plan`,
  `/test-cases`, `/qa`, `/sprint-status`에서 반복 분석합니다.
- **정보 손실:** Jira 댓글에 남긴 논의, 설계 결정, 엣지 케이스 토론 등의
  맥락이 매번 다르게 파싱됩니다.

## 2. 해결 방안
<!-- qab: id=solution -->

**가공된 통합 기능 컨텍스트**를 저장하는 버전 관리 KB를 도입합니다.
스킬은 KB를 먼저 읽고, 누락되었거나 변경된 정보만 Jira에서 조회합니다.

KB는 스킬을 통해 AI가 관리합니다. 스킬이 기능을 분석하면 KB 항목을
생성하거나 업데이트하는 PR을 만들고, 머지 전에 SDT 또는 개발자의
리뷰를 받습니다.

---

## 3. 저장 위치
<!-- qab: id=storage-location -->

KB 위치는 설정으로 변경할 수 있습니다. 스킬은 하드코딩된 경로가 아닌,
확인된 경로를 통해 KB를 참조합니다.

### 경로 확인 순서

1. **`.claude/settings.local.json`에서 설정 확인:**
   ```json
   { "featuresKbPath": "/path/to/knowledge-base" }
   ```

2. **현재 저장소 루트에 `features-kb/` 디렉터리가 있는지 확인:**
   ```bash
   git rev-parse --show-toplevel 2>/dev/null
   ```
   해당 경로에 `features-kb/`가 있으면 사용합니다.

3. **둘 다 없으면:** 사용자에게 생성 위치를 확인합니다.

### 배포 방식

| 방식 | 설정 | 적합한 상황 |
|------|------|------------|
| **동일 저장소** | 저장소 루트의 `features-kb/` | 단일 서비스 팀, 초기 도입 시 |
| **독립 저장소** | 설정에 절대 경로 또는 git URL 지정 | 멀티 서비스 팀, 서비스 간 공통 기능 |

기능이 여러 서비스에 걸쳐 있으면, KB를 **별도의 독립 저장소**에 만듭니다.

스킬에서 경로를 하드코딩하지 않습니다. 항상 동적으로 확인합니다.

---

## 4. 저장 대상 (가공 데이터만 저장)
<!-- qab: id=what-gets-stored -->

KB에는 **가공된 요약만** 저장하며, Jira 원본 데이터를 그대로 내보내지 않습니다.
"가공"이란 AI가 정보를 읽고, 통합하고, 일관된 형식으로 구조화했다는 의미입니다.

### 4.1 에픽 단위 (기능 수준)

| 데이터 | 출처 | 저장 내용 |
|--------|------|----------|
| 기능 설명 | Jira 에픽 설명 + Confluence PRD | 통합 요약: 무엇을, 왜, 누구를 위해, 사용자에게 미치는 영향 |
| 기능 상세 | Jira 에픽 필드, 라벨, 컴포넌트 | 상태, 스프린트, 수정 버전, 컴포넌트 태그 |
| 하위 티켓 참조 | Jira 연결된 스토리/태스크 | 티켓 키, 제목, 유형, 상태 (참조만 저장하며, 상세 내용은 티켓 파일에 기록) |
| 역량 (CAPs) | Jira 에픽 인수 조건(AC) + PRD 요구사항 | 기능이 제공하는 역량의 구조화된 목록 |
| 테스트 계획 | `/test-plan` 결과물 | 전략, 자동화 공백, 성공 기준, 리스크 |
| 기능 간 관계 | 다른 에픽과의 교차 참조 | 관련 기능 링크, 회귀 리스크 |

### 4.2 스토리/태스크 단위 (티켓 수준)

| 데이터 | 출처 | 저장 내용 |
|--------|------|----------|
| 인수 조건(AC) | Jira 티켓 AC | 테스트 가능 여부와 테스트 레이어가 배정된 구조화된 AC |
| 테스트 케이스 | `/test-cases` 결과물 | E2E 시나리오, 단위 테스트 체크리스트, 수동 테스트 케이스 |

### 4.3 기능 간 (KB 수준)

| 데이터 | 출처 | 저장 내용 |
|--------|------|----------|
| 테스트 케이스-AC 매핑 | `/test-cases` 결과물 | 어떤 테스트 케이스가 어떤 AC를 커버하는지, 커버리지 상태 |
| 기능 맵 | 자동 탐지 + 수동 입력 | 회귀 리스크 점수가 포함된 기능 의존성 그래프 |

---

## 5. 디렉터리 구조
<!-- qab: id=directory-structure -->

```
features-kb/
├── config.json                          # KB configuration
├── LEARNINGS.md                         # Project learnings (self-improve.md); committed
├── learnings-log.jsonl                  # Append-only run log: applied/contradicted/captured/outcome; committed
├── index.json                           # Feature index for fast lookup
├── features/
│   ├── {EPIC-KEY}/
│   │   ├── feature.md                   # Consolidated feature context (§4.1)
│   │   ├── test-plan.md                 # Test plan (from /test-plan)
│   │   ├── tickets/
│   │   │   ├── {TICKET-KEY}.md          # Per-ticket ACs + context (§4.2)
│   │   │   └── ...
│   │   ├── test-cases/
│   │   │   ├── {TICKET-KEY}.md          # Test cases (from /test-cases)
│   │   │   ├── {TICKET-KEY}-mapping.json # AC-to-test-case mapping (§4.3)
│   │   │   └── ...
│   │   ├── reviews/
│   │   │   ├── {TICKET-KEY}-review.md   # Ticket review (from /review-ticket)
│   │   │   └── ...
│   │   └── qa-reports/
│   │       ├── {TICKET-KEY}-{DATE}.md   # QA reports
│   │       └── ...
│   └── ...
└── relations/
    ├── feature-map.json                 # Feature dependency graph (§4.3)
    └── regression-map.json              # Regression test mapping
```

---

## 6. 파일 스키마
<!-- qab: id=file-schemas -->

### 6.1 config.json

```json
{
  "version": "0.2.0",
  "source": "jira",
  "jiraProject": "PROJ",
  "confluenceSpace": "TEAM",
  "lastSync": "2026-04-02T10:00:00Z",
  "storageMode": "same-repo",
  "syncThresholdHours": 24,
  "retentionPolicy": "until-feature-retired"
}
```

### 6.2 index.json

빠른 조회를 위한 인덱스 파일입니다. 스킬은 디렉터리 트리를 스캔하지 않고
이 파일을 먼저 읽어서 기능을 찾습니다.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "features": {
    "EPIC-100": {
      "title": "Invoice Management Redesign",
      "status": "in-progress",
      "sprint": "Sprint 24",
      "tickets": ["PROJ-101", "PROJ-102", "PROJ-103"],
      "capabilities": ["Create invoices", "Edit invoices", "Invoice PDF export"],
      "hasTestPlan": true,
      "testCaseCount": 12,
      "acCount": 15,
      "acCovered": 12,
      "lastUpdated": "2026-04-01T14:30:00Z",
      "tags": ["billing", "invoicing", "ui-redesign"]
    },
    "EPIC-200": {
      "title": "SSO Integration",
      "status": "planned",
      "sprint": null,
      "tickets": ["PROJ-201", "PROJ-202"],
      "capabilities": ["SAML SSO login", "SSO user provisioning"],
      "hasTestPlan": false,
      "testCaseCount": 0,
      "acCount": 8,
      "acCovered": 0,
      "lastUpdated": "2026-03-28T09:00:00Z",
      "tags": ["auth", "sso", "security"]
    }
  }
}
```

### 6.3 feature.md (에픽별)

통합된 기능 컨텍스트 문서입니다. 스킬은 Jira + Confluence를 처음부터
조회하는 대신 이 문서를 읽습니다.

```markdown
# Feature: {Epic title}

**Epic:** {EPIC-KEY}
**Status:** {planning | in-progress | testing | released | retired}
**Sprint:** {sprint name or "backlog"}
**Last synced from Jira:** {YYYY-MM-DD HH:MM}

---

## Summary
{2-3 paragraph consolidated summary of what this feature does, why it exists,
and who it's for. Written from the processed Jira epic description, PRD, and
team discussions.}

## Capabilities (CAPs)
{What this feature enables. Each CAP is a distinct capability the feature delivers.}

| # | Capability | Tickets | Status |
|---|-----------|---------|--------|
| CAP-1 | {capability description} | PROJ-101, PROJ-102 | {not started / in progress / done} |
| CAP-2 | {capability description} | PROJ-103 | {status} |

## Children Tickets

| Ticket | Type | Title | Status | ACs | Test Cases |
|--------|------|-------|--------|-----|-----------|
| PROJ-101 | Story | {title} | In Progress | 5 | 3 |
| PROJ-102 | Story | {title} | To Do | 3 | 0 |
| PROJ-103 | Task | {title} | Done | 2 | 2 |

## Acceptance Criteria (aggregated)

All ACs from all tickets under this epic, consolidated:

| # | AC | Ticket | Layer | Test Case | Status |
|---|-----|--------|-------|-----------|--------|
| AC1 | {Given... When... Then...} | PROJ-101 | E2E | TC-001 | {not tested / passed / failed} |
| AC2 | {AC text} | PROJ-101 | Unit | TC-002 | {status} |
| AC3 | {AC text} | PROJ-102 | API | — | {not covered} |

## Design & Architecture
{Key design decisions, architecture notes, data model changes. Sourced from
Confluence docs and Jira comments.}

### Figma / Mockups
- {link 1: description}
- {link 2: description}

### Confluence Docs
- {link 1: title}
- {link 2: title}

## Key Decisions
{Important decisions made during grooming/refinement that affect testing.
Sourced from Jira comments and team discussions.}

1. {Decision 1: what was decided and why}
2. {Decision 2: what was decided and why}

## Known Edge Cases
{Edge cases identified during review or testing}

1. {Edge case 1}
2. {Edge case 2}

## Related Features
{Features that interact with this one, sourced from relations/feature-map.json}

- {EPIC-50: Feature name} — {relation type} — {how they interact}
- {EPIC-75: Feature name} — {relation type} — {how they interact}

## Change Log
| Date | What changed | Source | Updated by |
|------|-------------|--------|-----------|
| 2026-04-02 | Initial creation from /test-plan | Jira EPIC-100 | Claude |
| 2026-04-03 | Updated ACs after grooming | /review-ticket PROJ-102 | Claude |
```

### 6.4 tickets/{TICKET-KEY}.md

티켓별 컨텍스트 파일입니다. 인수 조건(AC)과 테스트 커버리지에 초점을 둡니다.

```markdown
# {TICKET-KEY}: {Title}

**Type:** {story | bug | task}
**Epic:** {EPIC-KEY}
**Status:** {status from Jira}
**Sprint:** {sprint name}
**Last synced:** {YYYY-MM-DD HH:MM}

## Description
{Processed ticket description}

## Acceptance Criteria

| # | AC | Testable? | Test Layer | Test Case | Status |
|---|-----|----------|-----------|-----------|--------|
| 1 | {AC text} | Yes | E2E | TC-001 | Passed |
| 2 | {AC text} | Partial | Unit + Manual | TC-002, TC-003 | Not tested |

## Notes
{Key context from comments, design discussions, refinement notes}
```

### 6.5 test-cases/{TICKET-KEY}-mapping.json

AC와 테스트 케이스 간의 추적성 매핑 파일입니다.

```json
{
  "ticket": "PROJ-101",
  "epic": "EPIC-100",
  "lastUpdated": "2026-04-02T10:00:00Z",
  "mappings": [
    {
      "ac": "AC #1: User can create an invoice with valid data",
      "testCases": [
        { "id": "TC-001", "layer": "e2e", "type": "happy-path", "status": "passed" },
        { "id": "TC-002", "layer": "e2e", "type": "negative", "status": "passed" }
      ],
      "unitTests": ["invoice-creation-valid-data", "invoice-validation-required-fields"],
      "coverage": "full"
    },
    {
      "ac": "AC #2: Error message shown for invalid amount",
      "testCases": [
        { "id": "TC-003", "layer": "unit", "type": "negative", "status": "not-run" }
      ],
      "unitTests": ["amount-validation-negative", "amount-validation-zero"],
      "coverage": "full"
    }
  ],
  "unmappedACs": [],
  "testGaps": []
}
```

### 6.6 relations/feature-map.json

기능 간 관계를 추적하는 파일입니다.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "relations": [
    {
      "from": "EPIC-100",
      "to": "EPIC-50",
      "type": "extends",
      "description": "Invoice redesign changes the invoice creation flow that EPIC-50 originally built",
      "regressionRisk": "high",
      "sharedComponents": ["InvoiceForm", "BillingAPI", "invoice_items table"]
    }
  ]
}
```

**관계 유형:**
- `extends` -- 기존 기능 위에 새 기능을 추가
- `depends-on` -- 새 기능이 다른 기능에 의존
- `modifies` -- 새 기능이 기존 기능의 동작을 변경
- `replaces` -- 새 기능이 기존 기능을 대체
- `adjacent` -- 컴포넌트를 공유하지만 기능적으로는 독립

### 6.7 relations/regression-map.json

기능 맵에서 파생된 파일입니다. 특정 기능이 변경되었을 때 실행해야 할
테스트 목록을 관리합니다.

```json
{
  "lastUpdated": "2026-04-02T10:00:00Z",
  "regressionPaths": [
    {
      "trigger": "EPIC-100",
      "affectedFeatures": ["EPIC-50"],
      "testCasesToRun": ["EPIC-50/TC-001", "EPIC-50/TC-003", "EPIC-50/TC-007"],
      "reason": "Invoice redesign shares InvoiceForm and BillingAPI with EPIC-50"
    }
  ]
}
```

---

## 7. 읽기/쓰기 프로토콜
<!-- qab: id=read-write-protocol -->

### 7.1 읽기 (모든 스킬 공통)

스킬을 호출할 때마다 KB를 확인합니다.

```
1. KB 경로를 확인합니다 (§3 참조)
2. index.json을 읽어서 기능을 조회합니다
3. 기능이 존재하고 lastUpdated가 최신(24시간 이내)이면:
   → feature.md와 관련 하위 파일을 읽습니다
   → KB 데이터를 기본 컨텍스트로 사용합니다
   → Jira에서는 lastUpdated 이후의 티켓 상태 변경과 새 댓글만 조회합니다
4. 기능이 존재하지만 오래된 경우(24시간 초과):
   → feature.md를 기본 컨텍스트로 읽습니다
   → Jira에서 lastUpdated 이후 변경사항을 조회합니다
   → 새로운 정보로 feature.md를 업데이트합니다 (PR을 통해)
5. 기능이 존재하지 않으면:
   → Jira 전체 조회를 수행합니다
   → feature.md와 하위 파일을 생성합니다 (PR을 통해)
```

**유효 기간 기준:** 기본값 24시간이며, config.json에서 변경할 수 있습니다.
**확인 주기:** 스킬을 호출할 때마다 확인합니다.
실시간 상태가 필요한 스킬(예: `/sprint-status`)은 KB가 최신이더라도
항상 Jira에서 티켓 상태를 확인합니다.

### 7.2 쓰기 (KB를 생성하거나 업데이트하는 스킬)

모든 KB 업데이트는 PR 리뷰를 거칩니다.

1. **변경 내용을 파악합니다** -- 새 기능 항목인지, AC 업데이트인지, 새 테스트 케이스인지 확인합니다.
2. **브랜치를 생성합니다:** `kb-update/{EPIC-KEY}/{date}` 또는 `kb-update/{TICKET-KEY}/{date}`
3. **`features-kb/`에서 관련 파일을 업데이트합니다**
4. **index.json의 메타데이터를 업데이트합니다**
5. **새로운 기능 간 연결이 발견되면 relations/를 업데이트합니다**
6. **변경사항으로 PR을 생성합니다**
7. **머지 전에 SDT 또는 개발자의 리뷰를 받습니다**

같은 기능에 대해 여러 스킬이 연속으로 실행되면, 가능한 한 하나의 PR로
업데이트를 모아서 처리합니다.

### 7.3 스킬별 쓰기 대상

| 스킬 | 생성/업데이트 대상 |
|------|-------------------|
| `/test-plan` | `feature.md`, `test-plan.md`, `index.json`, `relations/` |
| `/review-ticket` | `tickets/{KEY}.md`, `reviews/{KEY}-review.md`, `feature.md` (엣지 케이스 추가) |
| `/test-cases` | `test-cases/{KEY}.md`, `test-cases/{KEY}-mapping.json`, `index.json` (testCaseCount, acCovered) |
| `/qa` | `qa-reports/`, `feature.md` (AC 테스트 상태 업데이트), `tickets/{KEY}.md` (테스트 상태 업데이트) |
| `/verify-fix` | `qa-reports/{BUG-KEY}-verify-{DATE}.md`, 결함 상태 업데이트 |
| `/sprint-status` | `index.json` (상태 업데이트) |
| `/exploratory` | `feature.md` (발견된 엣지 케이스 추가), `test-cases/` (새 시나리오) |

---

## 8. 기능 간 관계 탐지
<!-- qab: id=feature-relation-discovery -->

스킬이 기능 간 관계를 탐지하고 유지하는 방법을 설명합니다.

### 8.1 자동 탐지

기능을 분석할 때 다음 신호에서 관계를 찾습니다.

- **에픽 간 공유 Jira 라벨 또는 컴포넌트**
- **공유 코드:** 서로 다른 에픽의 테스트 케이스가 동일한 페이지, 컴포넌트,
  API 엔드포인트를 참조하는 경우
- **Jira 링크:** Jira의 에픽 간 링크 (blocks, relates-to)
- **공유 데이터베이스 테이블:** 기능들이 동일한 데이터 엔티티를 변경하는 경우

### 8.2 회귀 리스크 점수 산정

| 리스크 수준 | 기준 |
|------------|------|
| **High** | 핵심 컴포넌트나 데이터 모델을 공유합니다. 한쪽의 변경이 다른 쪽에 직접 영향을 줍니다. |
| **Medium** | 보조 컴포넌트를 공유합니다. 특정 조건에서 다른 쪽에 영향을 줄 수 있습니다. |
| **Low** | 인접하지만 독립적입니다. 서로 영향을 줄 가능성이 낮습니다. |

### 8.3 스킬에서 관계를 활용하는 방법

- `/test-plan` -- feature-map.json에서 관련 기능을 확인하고, High 리스크 관계에
  대해 회귀 테스트를 포함합니다.
- `/test-cases` -- regression-map.json에서 회귀 시나리오를 추가합니다.
- `/qa` -- 결함 수정 후 regression-map.json에서 영향을 받는 기능을 확인합니다.
- `/sprint-status` -- 현재 개발 작업 기준으로 회귀 리스크가 있는 기능을 표시합니다.

---

## 9. 동기화 전략
<!-- qab: id=sync-strategy -->

### 9.1 Jira가 정보 기준인 항목

다음 항목에서는 Jira가 정보 기준(Source of Truth)입니다.
- 티켓 상태 (To Do, In Progress, Done)
- 현재 스프린트 배정
- 에픽에 추가된 새 티켓
- 새 댓글과 논의 내용
- 인수 조건(AC) 텍스트

KB는 **가공된 캐시**이며, Jira를 대체하지 않습니다. Jira와 KB 사이에
충돌이 있으면 위 항목에 대해서는 Jira가 우선합니다.

### 9.2 KB가 정보 기준인 항목

다음 항목에서는 KB가 정보 기준입니다.
- 통합 기능 요약 (여러 Jira 소스를 가공하여 생성)
- 역량 (CAPs)
- 테스트 계획과 테스트 케이스
- AC-테스트 케이스 매핑
- 기능 간 관계와 회귀 맵
- 테스트 중 발견된 엣지 케이스
- 테스트 실행 상태

이 항목들은 Jira에 존재하지 않는 산출물입니다.

### 9.3 충돌 해결

스킬이 Jira와 KB 사이에 불일치를 발견하면 다음과 같이 처리합니다.
1. 티켓 상태, AC 텍스트, 스프린트 배정에 대해서는 Jira 데이터가 우선합니다
2. 테스트 산출물, 관계, 가공된 요약, CAPs에 대해서는 KB 데이터가 우선합니다
3. PR에 불일치를 표시합니다: "AC #3이 마지막 동기화 이후 Jira에서 변경됨"

---

## 10. 보존 정책
<!-- qab: id=retention-policy -->

**기능이 서비스에서 퇴역할 때까지 데이터를 유지합니다.**

이 KB는 장기간 유지되는 저장소입니다. 기능을 릴리스했다고 아카이브하거나
삭제하지 않습니다. 다음 용도로 계속 활용합니다.
- 회귀 테스트 (기존 기능의 동작을 이해)
- 새 기능 계획 (새로운 작업과 기존 기능의 관계를 파악)
- 온보딩 (신규 팀원의 제품 이해)

### 기능 상태 생명주기

```
planning -> in-progress -> testing -> released -> retired
```

`retired` 상태인 기능만 정리 대상이 될 수 있으며, 다른 기능이 해당 기능에
의존하지 않는지 확인한 후에만 정리합니다 (feature-map.json 확인).

---

## 11. 마이그레이션 경로
<!-- qab: id=migration-path -->

### Phase 1: 동일 저장소 (시작점)
- 서비스 저장소 내 `features-kb/` 디렉터리 사용
- 스킬이 KB 업데이트를 PR로 생성합니다 (SDT/개발자 리뷰 필요)

### Phase 2: 독립 저장소 (필요 시)
- 전환 시점: 서비스 간 공통 기능이 생기거나, KB 규모가 커질 때
- 별도 GitHub 저장소 사용
- PR 리뷰 워크플로우는 동일
- CI에서 PR 시 KB 스키마를 검증

### 마이그레이션 절차
1. 동일한 디렉터리 구조로 독립 저장소를 생성합니다
2. `features-kb/` 내용을 복사합니다
3. `.claude/settings.local.json`에서 `featuresKbPath` 설정을 업데이트합니다
4. 스킬이 자동으로 새 위치를 사용합니다
5. 서비스 저장소에서 `features-kb/`를 삭제합니다
