# 플랫폼

[English](README.md) · [한국어](README-ko.md)

Claude Code, Cursor, GitHub Copilot을 위한 플랫폼별 설정 및 설치 스크립트입니다.

## 설정 파일 작동 방식

각 `<platform>.json`은 다음을 정의합니다:

- **`reference_path`** — 런타임에 스킬이 방법론 참조 파일을 찾는 경로
- **`skills_install_dir`** — 설치 스크립트가 스킬을 설치하는 위치
- **`project_file`** — 출력 파일 이름 (CLAUDE.md, qabuddy.mdc, copilot-instructions.md)
- **`tool_groups`** — 추상적 그룹(예: `jira`, `browser`)을 플랫폼별 도구 이름으로 매핑
- **`tool_priority`** — 플랫폼별 브라우저/Jira 도구 가이드 텍스트

Claude Code는 `tool_groups`를 사용하여 스킬 frontmatter에 `allowed-tools`를 생성합니다. Cursor와 Copilot은 빈 배열을 사용합니다 — 에이전트가 사용 가능한 도구를 자동으로 탐색합니다.

## 설치 스크립트 옵션

| 옵션 | Bash | PowerShell | 효과 |
|------|------|------------|------|
| 기본값 | `setup` | `setup.ps1` | `qa-` 접두사로 설치 |
| 접두사 없음 | `--no-prefix` | `-NoPrefix` | 접두사 없이 설치 |
| 제거 | `--uninstall` | `-Uninstall` | 모든 QABuddy 심볼릭 링크 제거 |
| 상태 | `--status` | `-Status` | 현재 설치 상태 표시 |
| 프로젝트 (Cursor) | `--project` | `-Project` | 전역 대신 프로젝트에 복사 |

설치 스크립트는 추가로 다음 항목도 확인합니다:
- Atlassian MCP 설정
- Playwright MCP 설정 (Cursor만 해당)
- SessionStart hook 설정 (Claude Code + Cursor)
- Features 지식 베이스 디렉토리

## 새 플랫폼 추가

자세한 내용은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 참고하세요.
