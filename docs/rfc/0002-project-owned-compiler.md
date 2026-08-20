# RFC 0002 — Project-owned compiler configuration

**Status:** Draft | **Author:** Timothy Han (with Claude) | **Created:** 2026-08-19
**Depends on:** RFC 0001 (PR0–PR6, shipped as v0.5.0) · **Supersedes:** RFC 0001 §8 PR7/PR8 framing

## 한국어 요약

RFC 0001은 지식(레퍼런스 섹션 + 학습)을 실행마다 컴파일하고, 무엇이 쓰였는지 세는 데까지 왔다.
그런데 **한 층이 사용자 것이 아니다**:

| 레이어 | 소유 | 업데이트 후 생존 |
|---|---|---|
| 지식 (`LEARNINGS.md`) | 프로젝트 | ✅ |
| **선택 (어떤 섹션이 어떤 스킬에 가는가)** | **배포 파일의 `qab: scope=`** | ❌ |

2026-08-19에 QABuddy 저장소 안에서 스코프를 정리해 `/qa-qa` 슬라이스를 278줄에서 203줄로 줄였다.
**QABuddy 사용자는 같은 일을 할 수 없다** — 그 파일은 업데이트에 덮어써지고, 컴파일러는
`.qabuddy.json`에서 `learningsPath`·`runsDir`만 읽는다.

이 RFC는 세 가지를 프로젝트 소유로 만든다: **스코프 오버라이드**(바닥값 보장), **프로젝트 소유
레퍼런스 섹션**(팀 방법론), **게이트 리포트**(내 데이터가 점수화를 정당화하는가). 그 결과 RFC 0001의
PR7·PR8은 "QABuddy가 한 번 배포하는 단계"가 아니라 **프로젝트가 자기 측정으로 여는 능력**이 된다.

---

## 1. Problem

RFC 0001 §9.3의 판정("이 프로젝트의 증거로는 점수화가 정당화되지 않는다")에 도달하기까지 필요했던
작업은 전부 **배포되는 파일의 편집**이었다: `maintenance-and-ci`를 `qa` 스코프에서 빼고,
`#not-reproducible`을 두 스킬에 넓히고, 프리앰블의 심각도 척도 사본을 지우는 것.

사용자에게는 그 경로가 없다.

1. **스코프를 고칠 수 없다.** 자기 도메인에 맞지 않는 섹션이 매 실행 슬라이스에 실려도, 포크하거나
   업스트림 PR을 기다리는 것 외에 방법이 없다.
2. **팀 방법론을 컴파일 대상으로 넣을 수 없다.** 학습(`LRN-`)은 "한 사실 + 상태 + 증거 + 수명"이라
   팀의 안정적인 플레이북과 형태가 다르다.
3. **자기 데이터로 점수화를 열 수 없다.** 게이트를 통과할 만한 프로젝트여도 켤 방법이 없고,
   자기 로그가 게이트를 통과하는지 볼 방법도 없다.

**핵심:** QABuddy가 "팀에 맞춰 진화하는 파운데이션"이라면, 진화하는 층에 **선택**도 포함되어야 한다.
지금은 지식만 진화하고 선택은 고정이다.

## 2. Design

### 2.1 Scope overrides (project-level)

`.qabuddy.json`:

```jsonc
"compiler": {
  "scope": {
    "REF-playbook/maintenance-and-ci#ci-cd-pipeline": { "remove": ["qa"] },
    "REF-playbook/exploratory-heuristics#techniques-per-heuristic": { "add": ["test-cases"] }
  }
}
```

Rules:

- **Floor: `tier=must` cannot be removed.** A `remove` that would strip a section the target skill
  depends on structurally is **refused at compile time with a named error**, not silently ignored.
  Rails stay rails.
- **Unknown ids are refused** with the nearest suggestion — the same validation `log applied` already
  does, so a rename upstream surfaces as a loud error instead of a silently dead override.
- **Every override is visible in the manifest**: packed sections gain `via: project-override`,
  dropped ones `reason: project-override`. The slice stays self-explaining — you can always see why
  a section is or isn't there.
- Overrides apply **after** core scope resolution, so upstream changes to a section's default scope
  still flow through.

Why config and not file edits: shipped files are replaced on update. A project's `.qabuddy.json` is
versioned with the project, reviewable in a PR, and survives upgrades.

### 2.2 Project-owned reference sections

```jsonc
"compiler": { "references": ["features-kb/house/*.md"] }
```

- Same `qab:` contract as core references (`id`, `scope`, `tier`), so nothing new to learn.
- Ids are namespaced **`PRJ-<file-stem>#<id>`** — collision with shipped `REF-` ids is impossible,
  and a citation in the log is unambiguous about whose knowledge it was.
- They compile, are cited, counted by `stats`, and reviewed by distill exactly like `REF-` sections.

**Why not just use learnings?** A learning is one fact with `Status`/`Scope`/`Evidence` and a
lifecycle (`active → promoted | retired`) — it is *evidence that accumulated*. A team playbook
("we test payments this way") is stable authored methodology that never promotes anywhere. Forcing it
into `LEARNINGS.md` distorts both: distill would keep proposing to retire it for lack of `applied`
counts, and the learnings file stops being a record of what this project discovered.

### 2.3 Gate report

`node qab.js gate` evaluates RFC 0001 §9.3 **against this project's own logs** and prints:

- profiles and outcomes each, against the ≥ 2 × ≥ 8 threshold
- dormant sections (`in_slice ≥ N ∧ applied = 0`) with `in_slice`, and slice size per skill
- an explicit **eligible / not eligible** line with the reason

**The report assembles evidence; it does not classify causes.** Deciding whether a dormant section
"cannot fire", "is duplicated elsewhere" or "is waiting for work that hasn't happened" required human
judgement in RFC 0001 §9.3 and still does. The report therefore ends by asking for that classification
before scoring may be enabled — a tool that guessed the cause would reproduce exactly the error the
0001 verdict warns about.

### 2.4 PR7 / PR8 re-framed

Scoring (`compiler.scoring: true`) and auto status changes (`autoStatusChanges: true`) ship as code,
**default off**, and refuse to enable unless `qab.js gate` reports eligible — or the maintainer passes
an explicit override that is **recorded in the log** as a decision with a note.

The gate stops being a milestone QABuddy passes once, and becomes one each project passes for itself.

## 3. Resolved decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Overrides vs forking | project config, not file edits | shipped files are replaced on update; config is versioned with the project and reviewable |
| 2 | Can overrides remove anything? | **no — `tier=must` is a floor** | rails exist so a skill cannot be starved of what it structurally depends on; a config bug must not silently break a skill |
| 3 | Unknown id in an override | refused loudly with nearest-match suggestion | a silent no-op override is worse than an error: the project thinks it is configured |
| 4 | Namespace for project sections | `PRJ-<stem>#<id>` | citations must be unambiguous about provenance; no collision with shipped ids |
| 5 | Project sections vs learnings | both, distinct roles | a learning is accumulated evidence with a lifecycle; a playbook is authored and stable (§2.2) |
| 6 | Does `gate` classify dormancy causes? | **no — it assembles evidence and asks** | RFC 0001 §9.3 showed cause classification needs judgement; a guessing tool would repeat the mistake it warns about |
| 7 | Scoring default | off, and refuses to enable without eligibility | the 0001 verdict is that scoring on thin/narrow data is actively harmful |

## 4. Implementation sequence

| PR | Content | Behaviour change |
|---|---|---|
| **A** | `compiler.scope` overrides: config plumbing, must-floor, unknown-id refusal, manifest `via`/`reason`, tests + mutation smoke | none unless configured |
| **B** | `compiler.references`: `PRJ-` ids, index merge, citation + stats + distill participation | none unless configured |
| **C** | `qab.js gate` report | read-only |
| **D** | scoring behind gate eligibility (RFC 0001 PR7 design, per-profile with a floor) | flagged, default off |
| **E** | opt-in auto status changes (RFC 0001 PR8) | flagged, default off |

A–C are additive and independently useful; D–E stay closed until some project's data opens them.

## 5. Measurement

- Do projects actually configure overrides, and do their slices shrink as a result?
- Does any project's `gate` ever report eligible — and does scoring then improve applied ratio without
  fixture regression (RFC 0001 §9.3 kill criteria still apply)?
- Do project-owned sections get cited, or do teams keep everything in `LEARNINGS.md`?

## 6. Non-goals

- **No per-project scoring algorithm.** One algorithm, one flag. Tunable knobs would make every
  installation's behaviour unexplainable.
- **No LLM-written config.** `/qa-setup` may propose; a human writes `.qabuddy.json`.
- **No override of `tier=must`** (decision 2).
- **No cause classification by the tool** (decision 6).
- Overrides do not reach into skills — procedure stays authored (RFC 0001 Appendix B).

## 7. Open questions

1. Should `/qa-improve` distill *propose* scope overrides when it sees `in_slice ≥ N ∧ applied = 0`
   for a project, the way it proposes retirement for learnings today?
2. Does `gate` belong in `qab.js`, or is it a distill mode (`/qa-improve gate`)?
3. Do project sections need their own eval fixtures before they can be cited, or is the manifest
   enough traceability?
