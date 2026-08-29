# Project Learnings

Equivalence-fixture learnings — three entries covering: skill-scoped active,
all-scoped active, and retired (must never compile).

## LRN-20260801-01: 결제 실패 응답은 코드가 아니라 본문으로 판별한다
- **Status:** active
- **Scope:** qa
- **Statement:** 이 앱은 실패에도 HTTP 200을 반환한다 — 판정은 응답 본문의
  `result` 필드로 한다. 상태 코드 단언은 공허하게 통과한다.
- **Overrides:** 없음
- **Evidence:** 2026-08-01 픽스처 관측 — 200 + `{"result":"error"}` 실측.

## LRN-20260801-02: 테스트 계정은 워커 인덱스로 격리한다
- **Status:** active
- **Scope:** all
- **Statement:** 병렬 실행 시 계정 상태 공유로 레이스가 난다 — 계정은
  `user-w{workerIndex}` 패턴으로 격리한다.
- **Overrides:** 없음
- **Evidence:** 2026-08-01 픽스처 관측 — 동시 로그인 세션 만료 실측.

## LRN-20260801-03: 관리자 화면은 모바일 뷰포트를 지원하지 않는다
- **Status:** retired
- **Scope:** qa
- **Statement:** 관리자 페이지는 375px에서 레이아웃이 깨진다 — 모바일 확인 생략.
- **Overrides:** 없음
- **Evidence:** 2026-08-02 반증 — v2.1에서 반응형 지원 추가됨 (은퇴 사유).
