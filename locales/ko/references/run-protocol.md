# 실행 프로토콜: 컴파일된 슬라이스, 실행 디렉터리, 스크래치패드
<!-- qab: scope=improve,setup tier=must -->

모든 스킬 실행은 디렉터리 하나, 컴파일된 지식 슬라이스 하나, 스크래치패드 하나를 갖습니다.
컴파일러는 지식을 *선택*할 뿐 절대 고쳐 쓰지 않습니다. 설계: RFC 0001 (§3.7, §3.8, §5).

## 컴파일 단계
<!-- qab: id=compile-step -->

`node <references>/bin/akela.js compile --skill <skill> [--ticket <KEY>]` (정확한 명령은 프리앰블에
있음). 현재 실행이 없으면 실행을 시작하고, `<runsDir>/<run>/`에 씁니다:

| 파일 | 내용 |
|---|---|
| `slice.md` | 매니페스트(front matter) + **원문 그대로의** 소스 텍스트, 각각 `## <id> — <제목>`(REF) 또는 `## LRN-…` 아래 |
| `profile.json` | `{schema: profile/1, skill, surface, pom, ticket_kind, pfp}` — 결정적, `unknown`도 값 |
| `scratchpad.md` | `## Plan` · `## State` · `## Findings` · `## Candidate learnings` |
| `events.jsonl` | 이 실행의 로그 라인 (프로젝트 `learnings-log.jsonl`에도 추가됨) |
| `fingerprints.jsonl` | 이 실행의 실패 지문 (있는 경우; 프로젝트 `fingerprints.jsonl`에도 추가됨; `self-improve.md` §실패 지문) |

**후보** = `scope`가 이 스킬을 지명하는 레퍼런스 섹션(+ `all` 스코프의 `tier=must` 섹션) — 배포된
`REF-`와 프로젝트 소유 `PRJ-`(`compiler.references`) 모두 — ∪ `Scope`에
이 스킬(또는 `all`)이 있고 `Profile:`이 맞는 `active` 학습.
**패킹 (unscored, PR5):** `must` 먼저, 그 다음 파일 순서; 각 학습은 자기가 `Overrides`하는 섹션 바로 뒤,
없으면 맨 끝. **예산 상한 없음** — 슬라이스는 구성상 스킬이 이전에 읽던 것과 같고, `budget.used`만
기록해 슬라이스 크기를 지표로 삼습니다. `all` 스코프이면서 `must`가 아닌 섹션(KB 스펙, 용어)은
`dropped: general-scope`로 표시하고 넣지 않습니다. 프로젝트의 `.qabuddy.json`이 섹션의 스코프를
오버라이드할 수 있습니다(`compiler.scope`, RFC 0002): 오버라이드 때문에 들어간 섹션은
`via: project-override`를, 오버라이드가 뺀 섹션은 `dropped:`에 `reason: project-override`를
달고 나타납니다 — 슬라이스는 항상 스스로를 설명합니다. `tier=must`는 제거할 수 없습니다.
점수와 상한은 나중에 플래그 뒤에서 옵니다.

## 슬라이스 읽기
<!-- qab: id=reading-the-slice -->

시작 시 `slice.md`를 한 번 읽습니다; 학습 파일 읽기와 매니페스트에 나열된 레퍼런스 섹션 읽기를
**대체**합니다. 스킬이 이름 붙인 레퍼런스 파일은 매니페스트에 그 파일의 섹션이 없을 때만 엽니다.
매니페스트가 곧 출처입니다: `## <id>` 헤더를 이전과 똑같이 인용하고(`akela.js log applied <id>`),
`dropped:`로 아깝게 빠진 것을 확인합니다. **폴백:** 헬퍼를 쓸 수 없으면 스킬의 레퍼런스와 학습 파일을
직접 읽습니다(스킬 스코프, `active`) — 같은 집합, 매니페스트만 없음.

## 스크래치패드
<!-- qab: id=scratchpad -->

- `## Candidate learnings` (**모든 스킬**): 실행 중 눈에 띄는 것은 무엇이든, 증거 문턱 없이. 마무리 때
  세 가지 포착 트리거를 **이 후보들에게만** 적용합니다; 통과한 것은 증거가 있는 `LRN-` 항목이 되고
  나머지는 실행 디렉터리에 남습니다. 항목을 사실 하나로 유지하는 장치입니다.
- `## Plan` / `## State` (**tier-2 다단계 스킬**): Phase 1 전에 계획을 쓰고, 페이즈 경계와 모든 리뷰
  옵션 일시정지마다 상태를 갱신하고, 계속하기 전에 스크래치패드를 다시 읽습니다.
- `## Findings`: 자유 형식 작업 메모.

## 실행 디렉터리 보존
<!-- qab: id=retention -->

`runsDir`(기본 `.qa-reports/runs`)와 `retainRuns`(`captured` — 포착·모순이 있었던 실행 보존; `all`;
`none`)는 `.qabuddy.json`에 둡니다. 실행 디렉터리는 로컬입니다(`.qa-reports/`는 gitignore); 거기
미러된 로그 라인이 공유 기록입니다. 정리는 프로젝트가 필요로 하기 전까지 수동입니다.
