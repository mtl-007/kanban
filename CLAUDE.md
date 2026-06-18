# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

이 프로젝트는 `kanban/` 폴더 내의 파일만 작업 대상입니다. 상위 폴더는 읽거나 탐색할 필요가 없습니다.

## Project Overview

서버 없이 브라우저에서 직접 여는 순수 정적 파일 칸반보드입니다.

- **실행**: `index.html`을 브라우저에서 직접 열기 (빌드 도구, 서버 불필요)
- **의존성**: 없음 (vanilla HTML/CSS/JS)

## Architecture

3개 파일로 구성:

- `index.html` — 3컬럼(TO-DO / In-Progress / Done) 구조. 초기 샘플 카드 6장이 HTML에 직접 삽입됨. 각 컬럼은 `data-column` 속성으로 식별.
- `style.css` — 컬럼 색상, 드래그 시각 피드백(`.dragging`, `.drag-over`), 반응형(`@media max-width: 768px`).
- `app.js` — HTML5 Drag and Drop API 기반 드래그, 카드 추가/삭제, 카운터 갱신(`updateCardCounts`). 이벤트는 `.kanban-board`에 위임 처리.

## Key Behaviors

- `dragging` 클래스는 `requestAnimationFrame` 안에서 추가해야 드래그 고스트 이미지가 정상 표시됨.
- `dragleave` 오발화 방지: `e.relatedTarget`이 `.card-list` 내부일 때는 `.drag-over`를 제거하지 않음.
- 카드 ID는 `cardIdCounter`(초기값 100)로 증분 생성.

## Git Rules

- 브랜치 통합은 **반드시 merge**를 사용합니다. `rebase`는 금지합니다.

## Verification

- 작업 후 검증 시 **Playwright를 사용하지 않습니다**.
- 브라우저에서 `index.html`을 직접 열어 수동으로 확인하거나, `open`/`xdg-open` 등으로 실행합니다.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
