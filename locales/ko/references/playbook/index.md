# SDT Playbook -- 목차

모든 QABuddy 스킬이 공유하는 방법론입니다. 각 스킬은 필요한 파일만
참조합니다 -- 모든 파일을 한꺼번에 로드하지 마세요.

**Version:** 0.3.0

## 파일 목록


| 파일                        | 다루는 내용                                                                              | 사용하는 스킬                                                |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `terminology.md`            | 표준화된 용어 (AC, SDT, DoR, DoD 등)                                                     | 모든 스킬                                                    |
| `risk-and-priority.md`      | 심각도 척도 (6단계), 우선순위 척도 (3단계), 공수 배분, 의사결정 매트릭스                  | qa, test-plan, test-cases, review-ticket, exploratory        |
| `metrics-and-coverage.md`   | 코드 커버리지 (~80% 목표), 요구사항 커버리지, 향후 지표 자리표시자                        | qa, test-plan, sprint-status, exploratory                    |
| `shift-left.md`             | 요구사항을 조기에 검증하고 정합성을 확인하며 개발자를 지원하는 원칙                       | test-plan, review-ticket                                     |
| `test-distribution.md`      | 테스트 피라미드 (60/30/10), 다이아몬드 변형 (20/70/10), 중복 제거 규칙                    | test-plan, test-cases, review-ticket, exploratory            |
| `test-types.md`             | 수동 vs 자동화, UAT vs 기능 테스트, 탐색적 테스트 정의                                    | test-plan, test-cases, exploratory                           |
| `execution-sequence.md`     | 스프린트 내 테스트 순서 (dev -> PR -> QA -> verify-fix -> UAT -> release)                  | sprint-status                                                |
| `defect-lifecycle.md`       | 결함 유형, Jira 상태, SLA 기대치, 회귀 테스트 요구사항                                    | qa, test-plan, review-ticket, verify-fix                     |
| `maintenance-and-ci.md`     | 테스트 소유권, 불안정 테스트 처리 절차, 15분 시간 예산, CI 게이트, 브라우저 매트릭스       | test-cases, sprint-status, qa                                |
| `exploratory-heuristics.md` | 10가지 휴리스틱 범주, 휴리스틱별 기법 체크리스트, 발견 항목 분류                           | exploratory                                                  |

## 팀 프랙티스 (프로젝트별)

일부 프로세스는 팀마다 다르며 공유 플레이북에 포함되지 않습니다. 이러한 프로세스는 `features-kb/team-practices/`에 저장하고 `/qa-setup`으로 설정합니다:

| 파일 | 다루는 내용 | 참조하는 곳 |
|------|-----------|------------|
| `bug-triage.md` | 접수 프로세스, 초기 평가, 트리아지 주기 | `defect-lifecycle.md`, qa, sprint-status |
| `hotfix-testing.md` | 간소화된 테스트 절차, 생략 가능 항목, 브랜치 전략 | `defect-lifecycle.md`, qa, verify-fix |
| `test-data.md` | 시딩, 정리, fixture, 격리 | `test-types.md`, qa, test-cases, exploratory |
| `release-workflow.md` | 동결 규칙, 마감 시간, 롤백, 카나리 | `execution-sequence.md`, sprint-status |
| `accessibility.md` | WCAG 수준, 도구, 접근성 테스트가 필요한 기능 | `test-types.md`, qa, test-cases, exploratory |
