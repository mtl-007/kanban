# 칸반보드 구현 내용

## 개요

HTML, CSS, JS 순수 정적 파일로 구성된 드래그&드롭 칸반보드.
서버 없이 `index.html`을 브라우저에서 직접 열어 사용한다.

---

## 파일 구성

```
kanban/
├── index.html   # 보드 구조 및 초기 샘플 카드
├── style.css    # 레이아웃, 컬럼 색상, 드래그 시각 피드백
└── app.js       # 드래그&드롭, 카드 추가/삭제, 카운터 로직
```

---

## index.html

- 3개 컬럼을 `<section class="column" data-column="...">` 으로 구성
  - `data-column="todo"` → TO-DO
  - `data-column="inprogress"` → In-Progress
  - `data-column="done"` → Done
- 각 컬럼 내부 구조:
  - `.column-header` : 제목 `<h2>` + 카드 수 배지 `.card-count`
  - `.card-list` : 카드들이 위치하는 드롭 대상 영역
  - `.add-card-area` : 카드 추가 버튼 + 입력 폼 (토글)
- 초기 샘플 카드 6장 (TO-DO 3, In-Progress 2, Done 1) HTML에 직접 삽입
- 카드 구조: `draggable="true"` + 삭제 버튼 `.card-delete` + 제목 `.card-title` + 설명 `.card-desc`

---

## style.css

| 요소 | 스타일 |
|------|--------|
| `.kanban-board` | `display: flex`, `gap: 20px`, `align-items: flex-start` |
| `.column[data-column="todo"]` | 배경 연파랑 `#dbeafe` |
| `.column[data-column="inprogress"]` | 배경 연노랑 `#fef9c3` |
| `.column[data-column="done"]` | 배경 연초록 `#dcfce7` |
| `.column.drag-over` | 파란 외곽선 강조 (드래그 진입 시) |
| `.card` | 흰 배경, `border-radius: 8px`, `box-shadow`, `cursor: grab` |
| `.card.dragging` | `opacity: 0.4`, `rotate(2deg)` (드래그 중) |
| `@media (max-width: 768px)` | 컬럼 세로 배치 (반응형) |

---

## app.js

### 드래그 & 드롭 (HTML5 Drag and Drop API)

| 이벤트 | 대상 | 동작 |
|--------|------|------|
| `dragstart` | `.kanban-board` (위임) | `draggedCard` 저장, `.dragging` 클래스 추가, `dataTransfer` 설정 |
| `dragend` | `.kanban-board` (위임) | `.dragging` 제거, `draggedCard` 초기화 |
| `dragover` | 각 `.card-list` | `e.preventDefault()`, `.drag-over` 클래스 추가 |
| `dragleave` | 각 `.card-list` | `.drag-over` 제거 (자식 요소 오발화 방지 처리 포함) |
| `drop` | 각 `.card-list` | 카드를 해당 리스트로 `appendChild`, 카운터 갱신 |

> `dragleave` 오발화 방지: `e.relatedTarget`이 `.card-list` 내부일 때는 클래스를 제거하지 않음.

> `dragging` 클래스 적용 타이밍: `requestAnimationFrame` 으로 다음 프레임에 추가해야 드래그 고스트 이미지가 정상 렌더링됨.

### 카드 추가

1. `+ 카드 추가` 버튼 클릭 → 입력 폼 표시, 버튼 숨김
2. 폼 `submit` → `createCard(title)` 로 카드 DOM 생성 후 `.card-list`에 `appendChild`
3. 취소 버튼 → 폼 숨김, 입력 값 초기화

### 카드 삭제

- `.kanban-board`에 `click` 이벤트 위임
- `.card-delete` 버튼 클릭 시 `card.remove()` 후 카운터 갱신

### 카드 수 배지

- `updateCardCounts()` : 각 컬럼의 `.card` 수를 세어 `.card-count` 텍스트 갱신
- 카드 추가, 삭제, 드롭 시마다 호출

---

## 사용 방법

1. `index.html`을 브라우저에서 열기 (별도 서버 불필요)
2. 카드를 드래그해 다른 컬럼에 드롭
3. 컬럼 하단 `+ 카드 추가` 클릭 → 제목 입력 후 추가
4. 카드 우측 상단 `×` 클릭으로 삭제
