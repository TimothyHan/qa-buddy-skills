# 스킬

QABuddy의 AI 스킬입니다. 각 스킬은 YAML frontmatter와 마크다운 지시사항이 포함된 `SKILL.md` 파일이며, AI가 이 지시사항을 따릅니다.

## 스킬 구조

모든 스킬은 다음 구조를 따릅니다:

```
skill-name/
├── SKILL.md              # 스킬 지시사항 (300줄 이내)
└── tests/
    └── fixtures.json     # eval fixture (입력 시나리오 + 어설션)
```

`SKILL.md` 내부 구조:
1. **Frontmatter** — name, version, description, tool-groups, preamble-tier
2. **제약 조건** — AI가 반드시 따라야 할 규칙 (Phase 1 이전, 상단에 위치)
3. **단계** — 번호가 매겨진 순차적 워크플로우
4. **자기 평가** — 결과물 출력 전 검증 체크리스트
5. **결과물** — 생성되는 내용과 저장 위치
6. **완료 상태** — DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT

## 새 스킬 추가

자세한 내용은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)를 참고하세요.
