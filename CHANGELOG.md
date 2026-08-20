# 변경 이력

QABuddy의 주요 변경 사항을 기록합니다. 형식은
[Keep a Changelog](https://keepachangelog.com/ko/1.1.0/), 버전은
[유의적 버전](https://semver.org/lang/ko/)을 따릅니다 — 1.0 이전이므로 마이너 버전에서
스킬이 제거될 수 있습니다.

English: [CHANGELOG-en.md](CHANGELOG-en.md)

## [0.6.0] — 2026-08-20

RFC 0001의 호(arc)를 닫는 릴리스입니다. v0.5.0은 그 한가운데서 나갔습니다(PR0–PR6은
배포, PR7·PR8은 미결). 이번 릴리스는 그 결론을 배포합니다 — 게이트는 열렸고, 측정을
수행했고, 그 측정이 PR7을 만들지 말라고 답했습니다.

### ⚠️ 업그레이드 안내

`/qa-sprint-status`가 제거되었습니다. v0.5.0 이하에서 설치했다면 더 이상 존재하지 않는
스킬을 가리키는 항목이 남아 있습니다. **설치 스크립트를 다시 실행하면 자동으로
정리됩니다** — `dist/claude/setup` (또는 `setup.ps1`). `--status`는 잔여물을 `ORPHAN`으로
보고하고, install·uninstall이 제거합니다. 다른 도구의 스킬은 절대 건드리지 않습니다.

### 제거됨
- **`/qa-sprint-status`** (#29). 이 스킬이 쓰던 레퍼런스 섹션은 실제로 그것을 필요로 하는
  스킬들로 재배치했습니다 — 사라진 지식은 없습니다.
- `test-behavioral.md` (#36) — v0.1.0 이후 손대지 않은 수동 테스트 계획으로, 13개 스킬 중
  9개만 다루고 있었습니다. 그 역할은 eval 픽스처(13개 스킬 전부, 픽스처 67개)와 CI의
  설치·adopt 스모크가 대신합니다.

### 추가됨
- **"재현 불가"로 닫기 전에 실행 조건을 복원** (#24). 재현 단계는 보고자가 *한 일*을
  기록할 뿐, 그때 함께 참이었던 실행 조건 — 시각과 타임존, 로케일, 뷰포트, 계정, 데이터
  상태, 빌드 — 은 기록하지 않습니다. 하나씩 되돌려 보고, 그래도 재현되지 않으면
  *"다음 조건에서 재현되지 않음: {시도한 조건}"*으로 적습니다. 스코프: `/qa-qa`,
  `/qa-verify-fix`, `/qa-exploratory`, `/qa-review-ticket`, `/qa-test-cases`.
- **심각도 척도에 데이터 노출 축** (#27). 지금까지 심각도는 버그가 무엇을 *막는지*로
  매겼습니다. 이제 무엇을 *노출하는지*로도 매깁니다 — 자격 증명이나 개인정보를 봐서는 안
  될 사람이 읽을 수 있으면 Blocker, 다른 사용자의 데이터나 인증 없는 쓰기에 도달하면
  Critical, 인가는 동작하지만 새어 나가는 경우(상태 코드로 존재 여부 노출, 열거 가능한
  id, URL·로그의 민감 값)는 Major.
- **`playwright-patterns.md`로 승격된 패턴 2건** (#28) — 둘 다 실측된 실패에서 나왔습니다:
  Next.js 라우트 어나운서 함정, 그리고 단언 **이전에** 정리를 큐잉하는 규칙 — 4xx를
  기대했는데 201이 온 네거티브 테스트도 정리는 해야 하는데, 먼저 단언하면 throw가 큐잉을
  건너뛰기 때문입니다.
- **더 이상 배포하지 않는 스킬의 잔여 링크 정리** (#40) — 6개 설치 스크립트 전부, bash와
  PowerShell 5.1 CI 스모크 포함.
- **문서가 주장하는 사실을 저장소에서 도출해 검증** (#34, #37). 스킬 개수, `/qa-*` 명령
  참조, 플레이북 파일 수, 프리앰블 크기, 상대 링크가 이제 손 관리 대신 도출됩니다 —
  11행 중 5행이 어긋나 있던 플레이북 index의 "Used by" 열도 마찬가지입니다.

### 수정됨
- `qab.js compile`이 `--ticket`이 다르면 마커 run을 재사용하지 않습니다 (#19) — 버그 키
  실행이 스토리 run의 프로파일을 물려받던 결함.
- `qab.js`가 stdout이 닫혀도 EPIPE 스택 트레이스로 죽지 않습니다 (#22, `qab.js stats | head`).
- `qab.js`가 이미 outcome을 보고한 run에는 이벤트를 붙이지 않습니다 (#30).
- 심각도·우선순위 척도가 프리앰블에 중복되어 있었습니다. 이제 레퍼런스가 단일
  출처입니다 (#26). 로그에서 `#severity-scale`이 유휴로 보이던 원인이었습니다.
- 레퍼런스가 스킬 이름을 설치 기본값인 `qa-` 접두사로 표기합니다 (#20, 66곳).

### 변경됨
- **RFC 0001을 PR0–PR6에서 닫습니다** (#31). §9.3 게이트가 열렸고 — 프로파일 2개에
  outcome 9건·8건, 적용 편차 확인 — 게이트가 허가한 측정을 실제로 수행했습니다. 그 측정이
  점수화에 반대했습니다: 28회 실행에서 한 번도 적용되지 않은 18개 섹션 중 **선택 실패는
  0건**. 점수화가 얻어내려던 감축은 스코프 정리가 결정론적으로 달성했습니다. 이것은 한
  프로젝트의 데이터에 대한 판정이지, 점수화라는 발상에 대한 판정이 아닙니다.
- **PR7·PR8 재정의** — QABuddy가 한 번 배포하는 단계가 아니라 프로젝트가 자기 측정으로
  여는 능력으로. [RFC 0002](docs/rfc/0002-project-owned-compiler.md) (Draft, #32).
- README·CONTRIBUTING을 배포된 도구에 맞춰 정합 (#33, #34, #35, #38): 컨텍스트 컴파일러가
  이름과 다이어그램 자리를 갖고, `features-kb/` 트리가 학습 레이어를 보여주며, 낡은 수치를
  바로잡았습니다.

## 이전 릴리스

이 파일 이전입니다. 릴리스 노트를 참고하세요:
[v0.5.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.5.0) — 컨텍스트
컴파일러 (RFC 0001 PR0–PR6) ·
[v0.4.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.4.0) — 테스트 스위트
검증 방법론 ·
[v0.3.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.3.0) — 지원 정책,
`--adopt` 마이그레이션, 셀프 도그푸드 ·
[v0.2.3](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.3) — 설치 스크립트
소유권 검증 ·
[v0.2.2](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.2) ·
[v0.2.1](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.1) — Windows 수정 ·
[v0.2.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.0) — 스스로
진화하는 QA 파운데이션 ·
[v0.1.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.1.0) — 첫 릴리스
