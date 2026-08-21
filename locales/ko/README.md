# 로케일

[English](../README.md) · [한국어](README.md)

영어 이외의 팀을 위한 QABuddy 스킬 및 방법론 번역입니다.

## 사용 가능한 로케일

| 코드 | 언어 | 상태 |
|------|------|------|
| `ko` | 한국어 | 완료 — en/ko 완전 대응, 빌드가 강제 (`node build.js all`이 누락된 대응본이나 `qab:` id 불일치에서 실패) |

## 작동 방식

빌드 시스템은 `locales/<code>/`에서 먼저 파일을 로드하고, 번역되지 않은 파일은 `core/`의 영어 파일을 사용합니다. 부분 번역이 가능합니다.

```bash
node build.js all --locale ko    # 한국어 버전 빌드
```

결과물은 `dist/<platform>/` 대신 `dist/ko/<platform>/`에 생성됩니다.

## 디렉토리 구조

각 로케일은 `core/` 구조를 그대로 반영합니다:

```
locales/ko/
├── glossary.md              # 번역 스타일 가이드 + 용어 표준화
├── preamble-base.md         # Tier 1 프리앰블
├── preamble-full.md         # Tier 2 추가 내용
├── project-instructions.md  # CLAUDE.md / .mdc / copilot-instructions 템플릿
├── skills/                  # 스킬별 폴더 — core/와의 대응을 빌드가 강제
└── references/
    ├── playbook/            # 방법론 대응본 (core와 같은 qab: id, 빌드가 검증)
    ├── feature-knowledge-base-spec.md
    ├── playwright-patterns.md
    ├── run-protocol.md
    └── self-improve.md
```

## 번역 가이드라인

- 모든 산문을 번역합니다. 기술 용어, 코드 블록, 파일 경로, 상태 코드는 영어로 유지합니다.
- 번역 전에 용어집을 먼저 작성하세요 — 일관성이 완벽함보다 중요합니다.
- 프로덕션 사용 전에 원어민 QA 전문가의 검토를 받으세요.
- 잘 구성된 용어집의 예시로 `ko/glossary.md`를 참고하세요.
