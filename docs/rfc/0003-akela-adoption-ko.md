# RFC 0003 — Akela 도입: 트리 내 엔진을 추출된 컴파일러로 교체

| | |
|---|---|
| **상태** | Draft — 리뷰 대기 |
| **저자** | Timothy Han |
| **작성** | 2026-08-28 |
| **대체** | RFC 0001/0002의 *구현*(`bin/qab.js`); 그 결정들은 여전히 구속력을 가진다 |
| **로케일** | 이 문서는 [영문 원본](0003-akela-adoption.md)의 **비규범 전문 번역**입니다. 두 판이 다르면 영문판이 규범입니다. |

## 1 · 문제

QABuddy의 자기 학습 엔진(`bin/qab.js`, 1,189줄)은 **Akela**(npm `akela`, MIT, 의존성 0,
자체 120개 테스트 스위트)로 추출·일반화되었다: 어떤 마크다운 지식 베이스에도 쓸 수 있는
결정적 컨텍스트 컴파일러로, QABuddy를 명시적으로 지원한다(`qab:` 주석 마커 허용; 로그 리더는
`activity`의 별칭으로 `skill`을 받아들임; `--skill`/`--ticket`은 `--activity`/`--task`의 별칭).

한 엔진의 구현이 이제 둘 존재한다. 모든 수정이 두 번 들어가거나 어긋난다.
QABuddy는 추출이 예견했던 것, 즉 Akela의 **도메인 팩 소비자**가 되어야 한다 — QABuddy는
QA다움(활동, 프로브, 핑거프린트 어휘)을 기여하고, 선택·증거·게이트는 Akela가 소유한다.

## 2 · 동등성 증거 (정찰, 2026-08-28)

두 엔진을 도그푸드 워크스페이스의 사본(outcome 29개, 로그 290줄)에 대해 같은 입력으로
실행했다:

- **슬라이스 본문: 바이트 단위로 동일** (소스 28 · must 2 · 학습 15 · 268줄).
- **pfp: 동일** (`5408a28cb4ac`) — QABuddy의 프로브(surface/pom/ticket_kind, qab.js의
  `buildProfile()`)를 Akela의 선언적 규칙으로 옮기고 나면 — 같은 정규화, 같은 sha-256/12.
- **게이트: 동일한 산술** — 동일한 로그에 대해 (프로파일, outcome 수, 휴면 문턱). 문구는
  RFC 상호 참조에서만 다르다.
- 차이는 매니페스트 헤더(`skill:`→`activity:`, `compiler: akela <ver> domain: <pack>`),
  스크래치패드 주석 한 줄, 그리고 — PRJ 지식이 설정된 경우 — **PRJ 배치 순서**에 한정된다:
  qab은 PRJ를 id 정렬 스트림에 병합하고, Akela는 `knowledge[]` 배열 순서를 따른다. 같은 집합,
  같은 내용, 같은 `via:` 인과; 하네스는 PRJ가 설정된 곳에서는 집합 비교, 아닌 곳에서는
  바이트 비교를 한다.
- **모르는 활동 이름은 의도적으로 갈린다** (PR B에서 발견): qab은 컴파일한다(스코프 `all`
  학습은 여전히 패킹됨); 13개 활동을 선언하는 qa 팩을 쓰는 Akela는 exit 1로 거부하고 어휘를
  나열하며, 실행을 쓰지 않는다. 이는 컷오버 시점에 엄격성 업그레이드로 배포된다: #54 가드의
  가장 강한 형태(쓰레기 실행 없음, 로그 오염 없음)이며, 하네스에서 divergence로 단언된다.
- **PR C 레드워크 중 판정된 추가 차이** (각각 스위트에서 단언됨): 실행 마커 이동
  (`.qa-reports/.qab-run` → `.qa-reports/run`); 로그/fp 줄에 `activity`가 실림(리더는 과거의
  `skill`을 받아들임); 거부 문구 일반화("unknown section id", "source id must be",
  did-you-mean 목록); **지식 루트가 없으면 컴파일을 거부**(이전엔 경고); **네임스페이스당
  지식 루트 하나**(옛 스템 충돌 부류는 이제 설정 시점에 거부됨); stats는 없는 id에 "history —
  no longer in the knowledge base" 라벨을 붙이고 절대 승격하지 않는다.
- **해소됨 (구 §7 열린 질문):** akela 0.1.4가 `~/` 확장을 배포한다(다른 첫 소비자 발견
  사항과 함께: 인프로세스 임베딩을 위한 exported `main()`, 지식 루트 `exclude` 패턴).
  `akela-init`은 이제 `~/…` 경로를 내보내므로, 커밋된 akela.json이 팀원들의 머신을 넘나든다;
  런처는 엔진을 인프로세스로 실행한다. 핀을 0.1.4로 올렸고, 하네스가 업그레이드를 다시
  증명했다.
- **로그 호환은 단방향이다**: Akela는 과거의 `skill` 키 줄을 읽는다; qab.js는 `activity` 키
  줄을 읽지 않는다. 기존 프로젝트는 로그 변경 없이 이전하며, 새 줄이 쓰인 뒤에는 엔진 롤백이
  없다.

## 3 · 결정

1. **npm 의존성, dist는 자급자족 유지.** QABuddy는 `akela`를 핀한 `package.json`을 얻는다.
   Quick Start에 `npm install`이 추가된다. `build.js`가 `node_modules/akela`를
   `dist/<platform>/references/engine/`으로 복사해, 설치된 심링크가 런타임에 `node_modules`
   없이도 동작한다; `test.js`는 dist 사본이 핀된 버전과 일치함을 단언한다.
2. **설정 소유권 분리.** `akela.json`(커밋됨, 사용자가 편집)이 엔진을 소유한다: 지식 루트
   (배포되는 레퍼런스 + `PRJ` 프로젝트 파일), 스코프 오버라이드, 점수화, 예산.
   `.qabuddy.json`은 워크플로우 설정만 유지한다(contextSource, teamMode, …). 컨버터가 기존
   `compiler` 블록을 이전한다; `.qabuddy.json`에 남은 `compiler` 키는 컨버터 이름과 함께
   큰 소리로 실패한다.
3. **`qa` 도메인 팩이 QABuddy에 실려 배포되며** 다음을 담는다: 13개 활동, §2의 프로파일
   프로브(pfp 안정 — 검증됨), 닫힌 핑거프린트 어휘(`FP_KINDS`), 상태, 스크래치패드 템플릿.
4. **프리앰블은 `akela`를 호출한다;** `--skill`/`--ticket` 별칭이 QA 문구를 유지한다.
   `bin/qab.js`는 마이너 릴리스 하나 동안 엔진에 위임하는 얇은 deprecation 심이 되었다가
   제거된다.
5. **컷오버는 측정에 묶인다** (CONTRIBUTING "changing the compiler"): `test.js`의 동등성
   하네스가 커밋된 픽스처에 대해 §2를 전환 전과 전환 중에 다시 증명한다. §2에 문서화된 집합을
   넘어서는 동작 차이는 컷오버 PR을 막는다.
6. **탐지력 손실 없음.** `test.js`가 다루지만 Akela 스위트가 다루지 않는 엔진 동작은 qab.js가
   은퇴하기 전에 업스트림으로 이식된다(`akela`에 PR). QABuddy는 통합 검사만 유지한다: 팩
   정확성, 설정 계약, dist 배포, 프리앰블 참조, 하네스.
   *첫 사례는 이 RFC가 들어오기 전에 닫혔다:* qab 0.7.1의 조용한 빈 슬라이스 수정(소스 0개
   stderr 경고 + 별칭 정규화, `aliasPrefixes`로 일반화)이 **akela 0.1.3**(npm, 2026-08-28)으로
   업스트림에 배포되었고 게시된 아티팩트에 대해 검증되었다 — 다섯 가지 동작, 별칭 vs 정식
   이름으로 동일한 소스 집합. 따라서 의존성 핀은 `>=0.1.3`이다.
7. **RFC 0001/0002는 손대지 않는다** — 이제 Akela의 형태를 구속하는 결정의 역사적 기록이다
   (Akela의 코드가 이를 인용한다).

## 4 · 단계별 전달

- **PR A — 의존성 + 하네스.** `package.json`(akela 핀), CI `npm ci`, 동등성 하네스 + 커밋된
  픽스처. 동작 변화 없음; qab.js가 여전히 주 엔진.
- **PR B — qa 팩 + 설정.** `domains/qa.json`(또는 동등한 경로), `/qa-setup`의 akela.json
  계약, `.qabuddy.json` 컨버터 + 큰 소리의 stale 키 오류. 업스트림 테스트 이식은 병렬로
  진행.
- **PR C — 컷오버 (v0.8.0).** build.js가 엔진을 dist에 실어 배포; 프리앰블(en+ko)과 스킬
  텍스트가 `akela`로 전환; qab.js → 심; 엔진 테스트는 업스트림 이식이 들어오는 대로 test.js에서
  은퇴; 문서 일괄 정리(README들, 자기 학습 가이드, CONTRIBUTING); 업그레이드 노트 + 컨버터
  안내.

## 5 · 열린 질문

- 빌드 타임 `references/index.json`의 운명(`akela index`가 런타임 용도를 흡수; 빌드 타임
  en/ko id 패리티 검증은 `build.js`에 남는다).
- Cursor/Copilot dist가 엔진을 동일하게 배포하는가(검증되지 않은 티어; 구조적 패리티만).
- 이식 중 발견되는 업스트림 위시리스트(예: qab의 `gate`는 Akela의 것이 찍지 않는 RFC 0002
  § 참조를 찍는다; 외관상의 문제).
