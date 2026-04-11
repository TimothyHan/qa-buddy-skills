# 한국어 번역 용어집 (Korean Translation Glossary)

QABuddy 한국어 번역 시 용어 및 문체 기준.

## 번역 원칙

1. **자연스러운 한국어 문장 구조** — 영어 어순을 그대로 따르지 않는다. 한국어는 SOV 어순이므로 동사를 문장 끝에 배치한다.
2. **간결체(해요체/합니다체) 사용** — 기술 문서이므로 "~합니다", "~하세요" 체를 기본으로 사용. 과도한 존댓말은 피한다.
3. **영어 용어 병기** — 처음 등장 시 "한국어(English)" 형태로 병기하고, 이후에는 팀에서 더 자연스러운 쪽을 사용한다.
4. **능동태 우선** — "검증이 수행됩니다" 대신 "검증합니다"로 쓴다.
5. **명사 나열 지양** — "테스트 케이스 실행 결과 검증 완료" 대신 "테스트 케이스를 실행하고 결과를 검증합니다"로 풀어 쓴다.

## 용어 기준

### 영어 그대로 사용하는 용어 (번역하지 않음)

이 용어들은 한국 QA 현장에서 영어로 통용됩니다:

| 영어 | 이유 |
|------|------|
| Jira, Confluence, Playwright, MCP | 제품명 |
| PR (Pull Request) | 개발 용어로 통용 |
| CI/CD | 약어로 통용 |
| E2E, API, SDK, CLI | 기술 약어 |
| PASS, FAIL, BLOCKED, SKIP | 테스트 결과 코드 |
| DONE, BLOCKED, NEEDS_CONTEXT | 상태 코드 |
| VERIFIED, FAILED, REGRESSION | 검증 결과 코드 |
| READY, NEEDS WORK | 리뷰 판정 코드 |
| P0, P1, P2 | 우선순위 등급 |
| Blocker, Critical, Major, Normal, Minor, Trivial | 심각도 등급 (Jira 기본값) |
| fixture, assertion | 평가 프레임워크 용어 |
| slug | 기술 용어 |

### 한국어로 번역하는 용어

| 영어 | 한국어 | 비고 |
|------|--------|------|
| Acceptance Criteria (AC) | 인수 조건 (AC) | 첫 등장 시 병기, 이후 AC |
| Test case | 테스트 케이스 | |
| Test plan | 테스트 계획 | |
| Bug / Defect | 버그 (일반), 결함 (공식 문서) | 스킬 내에서는 "버그", 플레이북에서는 "결함" |
| Sprint | 스프린트 | |
| Severity | 심각도 | |
| Priority | 우선순위 | |
| Unit test | 단위 테스트 | |
| Integration test | 통합 테스트 | |
| Exploratory test | 탐색적 테스트 | |
| Regression test | 회귀 테스트 | |
| Test coverage | 테스트 커버리지 | |
| Code coverage | 코드 커버리지 | |
| Knowledge base (KB) | 지식 베이스 (KB) | 첫 등장 시 병기, 이후 KB |
| Traceability | 추적성 | |
| Flaky test | 불안정 테스트 | "플레이키 테스트"도 통용되나 "불안정 테스트"가 공식적 |
| Smoke test | 스모크 테스트 | |
| Grooming / Refinement | 그루밍 / 리파인먼트 | |
| Workflow | 워크플로우 | |
| Dashboard | 대시보드 | |
| Charter | 차터 | 탐색적 테스트 용어 |
| Heuristic | 휴리스틱 | |
| Upstream | 업스트림 | |
| Preamble | 프리앰블 | |
| Skill | 스킬 | |

### 자주 틀리는 표현

| 부자연스러운 번역 | 자연스러운 표현 |
|---|---|
| "컨텍스트를 복구하세요" | "이전 작업 상태를 확인하세요" |
| "산출물이 전달됨" | "결과물 전달 완료" |
| "일시 중지 지점" | "검토 시점" or "확인 단계" |
| "구조화된 개선 제안을 생성" | "개선안을 작성" |
| "~에 대해 문서화된 프로세스가 있는지" | "~에 대한 절차가 정의되어 있는지" |
| "도구가 무엇을 잘못했습니까?" | "어떤 부분이 기대와 다르게 동작했나요?" |
| "심볼릭 링크가 재빌드된 dist/를 자동으로 참조" | "심볼릭 링크가 빌드된 결과물을 바로 반영합니다" |
| "SDT에게 물어보는 것으로 대체한다" | "SDT에게 직접 확인합니다" |
| "진행 불가" | "진행할 수 없음" or "차단됨" |

## 문장 패턴

### 지시문 (스킬 내 지시사항)

```
영어: "Read the skill's SKILL.md and verify..."
부자연: "스킬의 SKILL.md를 읽고 검증하세요..."
자연: "해당 스킬의 SKILL.md 파일을 확인하고..."

영어: "If prior context is found, summarize..."
부자연: "이전 컨텍스트가 발견되면 요약하세요..."
자연: "이전 작업 내역이 있으면 요약해서 보여주세요..."

영어: "Never refuse to run a skill because..."
부자연: "~때문에 스킬 실행을 거부하지 마세요..."
자연: "~인 경우에도 스킬을 정상적으로 실행하세요..."
```

### 테이블 헤더

```
영어 코드 그대로: Status, Priority, Ticket, Result, Bug Key
한국어로: 사용 시점, 설명, 기능, 비고, 확인 항목
```
