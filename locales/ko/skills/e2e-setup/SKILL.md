---
name: e2e-setup
version: 0.1.3
description: |
  이 팀과 앱에 맞춘 Playwright e2e 자동화를 셋업합니다. 실행 중인 앱을
  프로브(인증 방식, API 표면, 스펙 존재 여부)하고, 열린 질문 대신 추천을
  제시하는 인터뷰를 진행하고, playwright/ 폴더를 스캐폴드하고, 모든 결정을
  playwright/AUTOMATION.md에 기록해 다른 e2e 스킬들이 읽게 합니다.
  스캐폴드가 green으로 실행되기 전까지 셋업은 끝난 것이 아닙니다.
  사용 시점: "e2e setup", "set up playwright", "configure test automation", "automation setup".
  사용하지 않을 때: 페이지 객체 빌드 시 (/qa-e2e-pom 사용), 테스트 스크립트 작성 시 (/qa-e2e-write 사용), QABuddy 일반 설정 시 (/qa-setup 사용).
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
  - browser
preamble-tier: 1
---

# /qa-e2e-setup: Playwright 자동화 셋업

이 팀의 앱을 위한 Playwright를 한 번 구성합니다. 여기서 결정된 모든 것은
`playwright/AUTOMATION.md`에 기록됩니다 -- `/qa-e2e-pom`과 `/qa-e2e-write`는 매
실행마다 다시 묻는 대신 이 파일을 읽습니다.

**코드 표준:** config, fixture, 스펙을 생성하기 전에
`{{REFERENCE_PATH}}/playwright-patterns.md`를 읽으세요 -- 이 스킬의
스캐폴드가 따라야 할 결정 테이블, 템플릿, 함정이 거기 있습니다. 그 다음
프로젝트 학습 파일(프리앰블 참조) -- 이 스킬에 스코프된 active `LRN-`
항목이 그 패턴들을 오버라이드합니다.

## 제약 사항

1. **묻기 전에 프로브.** 실행 중인 앱에서 발견 가능한 것(인증 방식, API 스펙,
   세션 저장 방식)은 프로브하지, 절대 묻지 않습니다.
2. **열린 질문 대신 추천.** 모든 인터뷰 단계는 프로브에서 도출한 추천을
   "(Recommended)" 표시와 함께 대안과 나란히 제시합니다. 추천 없이 "어떤 인증
   전략을 원하시나요?"라고 묻지 않습니다. 헤드리스: 추천이 곧 결정입니다 --
   AUTOMATION.md의 **Auto-decisions** 줄에 기록합니다.
3. **모든 결정은 AUTOMATION.md에.** 기록되지 않은 결정은 나중에 다시 묻게
   됩니다 -- 그것은 결함입니다.
4. **스캐폴드가 실행되어야만 셋업 완료.** `npx playwright test --list`가 exit
   0이어야 하고, 생성된 스모크 스펙이 앱에 대해 통과해야 합니다. 그 전까지
   상태는 DONE이 아니라 BLOCKED입니다.
5. **자격 증명은 `.env`(gitignore됨)에. 커밋되는 파일이나 채팅에는 절대 금지.**

---

## Phase 1: 입력

사용자(또는 호출 컨텍스트; 헤드리스: 환경변수 `BASE_URL`, `TEST_USER`,
`TEST_PASS` 또는 `.env`)로부터 수집:

- 앱 base URL (로컬 또는 pre-production)
- 테스트 계정 자격 증명 + **테스트 계정이 몇 개 있는지** (병렬성 상한)
- 자동화 코드를 둘 대상 레포/디렉토리

기존 셋업 확인: `playwright/AUTOMATION.md`가 있으면 보여주고 재구성-또는-유지를
묻습니다 (`/qa-setup`이 `.qabuddy.json`에 하듯이). 헤드리스: 유지 -- 절대
재구성하지 않습니다.

## Phase 2: 앱 프로브

브라우저에서 base URL을 열고, 이 순서로 기록합니다:

1. **인증 방식.** 로그인 폼이 있는가? 네트워크 트래픽을 캡처하며 테스트
   계정으로 한 번 로그인합니다. 판별:
   - 엔드포인트 + 메서드 (예: `POST /api/auth/login`)
   - 세션 캐리어: `Set-Cookie`(쿠키 세션) vs 응답 본문의 토큰을 localStorage에
     저장 vs SSO 리다이렉트(도메인이 IdP로 변경)
2. **API 스펙 존재 여부.** `/api/docs`, `/openapi.json`, `/swagger.json`,
   `/docs`를 시도합니다. 아무것도 응답하지 않으면 기록: API 디스커버리는 UI
   워크 중 **네트워크 캡처**로 (OpenAPI 없음).
3. **테스트 속성 컨벤션.** DOM에서 `data-testid` vs `data-test` vs `data-cy`를
   확인합니다. `data-testid`가 아니면 config에 `use.testIdAttribute` 필수 --
   그리고 러너 밖 raw Playwright 스크립트는 별도로
   `selectors.setTestIdAttribute(...)`가 필요하다는 점도 기록.
4. **앱 형태.** SPA vs MPA(전체 페이지 로드?), base path, 눈에 띄는 환경 배너
   (스테이징/프로드 가드).

인터뷰 전에 프로브 결과를 3–5줄로 사용자에게 보고합니다.

## Phase 3: 인터뷰 (추천 우선)

아래 결정들을 순회합니다. 각각: 프로브 근거 → 추천 → 대안. 한 번에 하나씩.

### 3a. 인증 전략

| 프로브 결과 | 추천 |
|---|---|
| 로그인 API를 통한 쿠키 세션 | global setup으로 **storageState**; 한 번 로그인, 상태 저장 |
| 테스트 계정 여러 개 | `parallelIndex`로 할당하는 worker-indexed storageState 파일 (3a-ii 참조) |
| localStorage의 토큰 | storageState가 여전히 동작 (localStorage도 캡처) -- global setup |
| SSO / IdP 리다이렉트 | 사용자가 한 번 수동 로그인, 수명 긴 storageState 저장; 갱신 절차 플래그 |

### 3a-ii. 병렬성 -- 기본은 병렬, 절대 2 worker 미만 금지

직렬로만 통과하는 스위트는 순서 의존 버그를 숨기고 있습니다. 추천:

```
workers = clamp( floor(cpu_cores / 2), 최소 = 2, 최대 = 사용 가능한 계정 수* )
```

코어 수를 감지하고(`os.cpus().length` / `sysctl -n hw.ncpu`), 도출된 숫자를
제시하고, 사용자가 오버라이드하게 하되 -- **절대 2 미만은 안 됩니다**. 도출
과정을 AUTOMATION.md에 기록합니다.

*계정 산수가 격리 전략을 결정합니다:*

| 상황 | 전략 |
|---|---|
| 계정 ≥ worker | **Worker-indexed 계정**: global setup이 계정별 로그인 → `.auth/worker-{i}.json`; `storageState` 옵션 fixture가 `parallelIndex`로 할당. 사용자 상태 완전 격리. |
| 계정 < worker, 가입 API 존재 | API로 테스트 계정 **추가 프로비저닝** 제안 (먼저 물어볼 것; 헤드리스: 프로비저닝하지 않고 제약을 기록) |
| 계정 하나 / 전역 공유 상태(단일 테넌트) | 엔티티 스코프 테스트를 위해 worker는 ≥2 유지; **전역 또는 사용자별 공유 상태를 변경하는** 테스트는 병렬 페이즈 이후에 실행되는 종속 Playwright 프로젝트(`dependencies: ['parallel'], workers: 1`)로. 프로젝트별 `workers: 1`은 필수 -- `--repeat-each`는 같은 파일의 인스턴스도 워커에 분산시키므로 파일 묶기만으로는 직렬화되지 않습니다. |

어떤 기능이 공유 상태인지 명시적으로 경고하세요 (프로브: 데이터가 사용자별인가
전역인가?) -- `/qa-e2e-write`가 그 테스트들을 그에 맞게 그룹화하도록.

### 3b. White-box 모드

한 번만 묻습니다: "앱의 소스 레포에 제가 접근할 수 있나요? (경로 또는 'no')"
헤드리스: `features-kb/features/*/sources.json`이 있으면 cwd가 앱 레포 → (A) 제안.
- **가능** → 후속 질문: 요소에 안정적인 셀렉터가 없을 때, **(A) 개발자용
  diff로 `data-testid` 패치를 제안**할까요 (Recommended), 아니면 **(B) 앱
  레포의 브랜치에 적용**할까요?
- **불가능** → black-box 모드: `/qa-e2e-pom`이 패치 대신 테스트 가능성 갭
  보고서를 냅니다.

### 3c. POM 스타일

| 팀 형태 | 추천 |
|---|---|
| 여러 팀이 프레임워크 공유 | 무상태 함수형 POM (모듈 + `page` 인자) |
| 소규모 팀, 긴 플로우 | 클래스 기반 POM (얕은 BasePage까지만) |
| 페이지 객체가 많아 생성 노이즈 | fixture 주입 POM |

### 3d. 레이아웃, CI, 위생

- 모든 Playwright 파일은 단일 `playwright/` 폴더 아래 -- `src/`에 섞지 않음
- CI 시스템 → `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`
- 리포터: 로컬은 `html`; 후처리가 필요할 때만 커스텀 리포터 추가

## Phase 4: 스캐폴드

대상 레포에 생성:

```
playwright.config.ts       # 레포 루트 -- bare `npx playwright test`가 동작하도록
playwright/
  AUTOMATION.md            # 결정 파일 (Phase 6 템플릿)
  .auth/                   # storageState 출력 (gitignore됨)
  global-setup.ts          # 프로브한 엔드포인트로 로그인 → storageState 저장
  tests/smoke.spec.ts      # baseURL 접속(인증됨) + 보이는 요소 하나 단언
  .env.example             # BASE_URL, TEST_USER, TEST_PASS (실제 값은 .env로, gitignore됨)
```

config는 레포 루트에 둡니다(테스트 디스커버리 편의); 나머지는 전부
`playwright/` 아래. config는 `baseURL`, `testDir: './playwright/tests'`,
`globalSetup` 연결, 저장된 파일을 기본 `storageState`로 설정해야 합니다.
스모크 스펙은 user-facing 로케이터(`getByRole`/`getByTestId`)만 사용 -- 다른
모든 스펙과 같은 스펙 린트의 적용을 받습니다. 의존성 설치:
`npm i -D @playwright/test` (+ 브라우저 없으면 `npx playwright install chromium`).

## Phase 5: 실행 게이트

1. `npx playwright test --list` → exit 0 (config 파싱됨, 스펙 발견됨)
2. `npx playwright test` → 스모크 스펙 green (인증 + baseURL + 셀렉터 전부 실제 동작)

실패하면: 고치고 재실행. 게이트가 red인 채로 DONE을 보고하지 않습니다.

## Phase 6: 결정 기록

`playwright/AUTOMATION.md` 작성:

```markdown
# Automation Decisions — {앱 이름}
- Base URL: {url} | Env: {local|pre-prod}
- Auth: {프로브된 방식} → {전략}
- Parallelism: workers = {n} (cores {c} → {c/2}, 최소 2, {accounts}개 계정으로 상한);
  isolation: {worker-indexed accounts | 종속 global-state 프로젝트, 대상: {기능들}}
- API discovery: {openapi url | 네트워크 캡처 (OpenAPI 없음)}
- White-box: {레포 경로 + propose|apply | black-box}
- POM style: {functional|class|fixture-injected}
- CI: {시스템}; retries/forbidOnly 구성됨
- Data hygiene: 고유 이름 필수 (worker+repeat 엔트로피), API로 정리
```

## 출력 전 자기 평가

- [ ] 프로브 가능한 모든 사실은 묻지 않고 프로브했다
- [ ] 모든 질문에 추천이 붙어 있었다
- [ ] AUTOMATION.md에 병렬성 제약 포함 모든 결정이 기록됐다
- [ ] 두 실행 게이트가 모두 실행되고 통과했다
- [ ] 커밋되는 파일에 자격 증명 없음

**Status:** DONE | BLOCKED (게이트 red -- 어떤 명령이 왜 실패했는지 명시)
**Summary:** {앱} Playwright 구성 완료: {인증 전략}, {n} workers, {POM 스타일}
**Next steps:** /qa-e2e-pom으로 첫 페이지 객체 빌드
