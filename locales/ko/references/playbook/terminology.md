# 용어 정의
<!-- qab: id=terms scope=all -->

모든 산출물에서 아래 용어를 통일하여 사용합니다. 테스트 계획, 테스트 케이스,
보고서, Jira 코멘트 작성 시 일관되게 적용합니다.

| 용어 | 의미 | 비고 |
|------|------|------|
| API test | 통합 테스트 | 서비스 간 계약과 데이터 흐름을 검증합니다 |
| E2E test | End-to-end 테스트 | Playwright 기반 브라우저 테스트로, 실제 사용자를 시뮬레이션합니다 |
| Unit test | 단위 테스트 | 개발자가 소유하며, 개별 함수/모듈을 격리하여 테스트합니다 |
| UAT | 사용자 인수 테스트 | 워크플로우 중심이며, 기능적 원인-결과 방식이 아닙니다 |
| Exploratory test | 탐색적 테스트 | 스크립트 없이 기능을 탐색하여 미지의 시나리오를 발견합니다 |
| SDT | Software Developer in Test | 팀 내 QA 역할 |
| AC | 인수 조건 (Acceptance Criterion) | 티켓에 정의된 테스트 가능한 조건 |
| DoR | Definition of Ready | 스프린트 투입을 위한 티켓의 최소 품질 기준 |
| DoD | Definition of Done | 릴리스를 위한 티켓의 최소 품질 기준 |
| Smoke test | 스모크 테스트 | 핵심 워크플로우가 정상 동작하는지 빠르게 확인합니다 |
| Regression test | 회귀 테스트 | 변경 후에도 기존 기능이 정상 동작하는지 확인합니다 |
| Flaky test | 불안정 테스트 | 코드 변경 없이도 통과/실패가 일관되지 않는 테스트 |
| Pre-release bug | 내부 테스트 중 발견한 결함 | 최종 사용자에게 영향 없음 |
| Production bug | 운영 환경에서 발견한 결함 | 최종 사용자에게 영향이 있으며, SLA 대응이 필요합니다 |
