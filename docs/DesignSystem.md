# Design System — 칸반보드

## 1. 색상

모든 색상은 `:root`에 CSS Custom Properties로 정의되어 있습니다.

### 컬럼 색상 변수

| CSS 변수 | 값 | 사용처 |
|----------|----|--------|
| `--color-todo-bg` | `#dbeafe` | TO-DO 컬럼 배경 |
| `--color-todo-border` | `#bfdbfe` | TO-DO 컬럼 테두리 |
| `--color-inprogress-bg` | `#fef9c3` | In-Progress 컬럼 배경 |
| `--color-inprogress-border` | `#fde68a` | In-Progress 컬럼 테두리 |
| `--color-done-bg` | `#dcfce7` | Done 컬럼 배경 |
| `--color-done-border` | `#bbf7d0` | Done 컬럼 테두리 |

### UI 색상 변수

| CSS 변수 | 값 | 사용처 |
|----------|----|--------|
| `--color-text-primary` | `#1e293b` | 본문, 카드 제목 |
| `--color-text-secondary` | `#64748b` | 카드 설명, 버튼 텍스트 |
| `--color-text-muted` | `#94a3b8` | 삭제 버튼 기본 색 |
| `--color-card-bg` | `#ffffff` | 카드 배경 |
| `--color-drag-highlight` | `#3b82f6` | `.column.drag-over` 테두리 |
| `--color-danger` | `#ef4444` | 삭제 버튼 hover 색 |
| `--color-danger-bg` | `#fee2e2` | 삭제 버튼 hover 배경 |
| `--color-btn-primary` | `#3b82f6` | 추가 확인 버튼 |
| `--color-btn-primary-hover` | `#2563eb` | 추가 확인 버튼 hover |

### 공간 / 그림자 변수

| CSS 변수 | 값 |
|----------|----|
| `--radius-card` | `8px` |
| `--radius-column` | `12px` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.12)` |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.15)` |

---

## 2. 타이포그래피

| 요소 | CSS 값 | 실제 크기 | 폰트 굵기 |
|------|--------|-----------|-----------|
| 보드 제목 `h1` | `1.5rem` | 24px | 600 |
| 컬럼 제목 `h2` | `1rem` | 16px | 700 |
| 카드 제목 `.card-title` | `0.875rem` | 14px | 600 |
| 카드 설명 `.card-desc` | `0.75rem` | 12px | 400 |
| 카드 수 배지 `.card-count` | `0.78rem` | ~12.5px | 600 |

- 폰트 스택: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- 입력 필드는 `font-family: inherit`으로 보드 폰트를 상속

---

## 3. 컴포넌트

### 3.1 컬럼 (`.column`)

```
┌──────────────────────────────┐
│  컬럼 이름            [N]    │  ← .column-header
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ 카드                   │  │  ← .card
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 카드                   │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│  + 카드 추가                 │  ← .btn-add-card
└──────────────────────────────┘
```

- `border-radius`: `var(--radius-column)` = 12px
- `padding`: 16px
- `min-width`: 260px (`flex: 1`로 균등 분배)
- 드래그 오버 시: `border-color: var(--color-drag-highlight)`, `border-style: dashed`, 외곽 glow 추가

### 3.2 카드 (`.card`)

```
┌──────────────────────────────┐
│ 카드 제목              [×]   │
│ 카드 설명 텍스트             │
└──────────────────────────────┘
```

- `background`: `var(--color-card-bg)` = `#ffffff`
- `border-radius`: `var(--radius-card)` = 8px
- `box-shadow`: `var(--shadow-card)` = `0 1px 3px rgba(0,0,0,0.12)`
- `padding`: `12px 36px 12px 14px` (우측 36px는 삭제 버튼 공간)
- `cursor`: `grab` / 드래그 중 `grabbing`
- 드래그 중 (`.card.dragging`): `opacity: 0.4`, `transform: rotate(2deg)`

### 3.3 삭제 버튼 (`.card-delete`)

- 위치: 카드 우측 상단 절대 배치
- 평상시: 투명 (`opacity: 0`)
- 카드 hover 시: 노출 (`opacity: 1`)
- 클릭 시: 빨강 배경 전환

### 3.4 카드 추가 폼

```
┌──────────────────────────────┐
│ [카드 제목 입력         ]    │  ← input[maxlength=50]
│              [추가] [취소]   │
└──────────────────────────────┘
```

- 폼은 `hidden` 속성으로 토글 (`.add-card-form[hidden] { display: none }`)
- `[추가]` 버튼: `var(--color-btn-primary)` 파랑 배경, 흰 텍스트
- `[취소]` 버튼: 배경 없음(`background: none`), 회색 테두리 / hover 시 빨강 테두리

---

## 4. 레이아웃

### 보드 레이아웃

```css
.kanban-board {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 28px 32px;
  min-height: calc(100vh - 60px);
}
```

### 반응형 (≤768px)

```css
@media (max-width: 768px) {
  .kanban-board {
    flex-direction: column;
    padding: 16px;
  }
  .column {
    min-width: unset;
    width: 100%;
  }
}
```

---

## 5. 상태 표현

| 상태 | 표현 방법 |
|------|-----------|
| 드래그 중 카드 | `.card.dragging` — `opacity: 0.4` + `rotate(2deg)` |
| 드롭 가능 컬럼 | `.column.drag-over` — 파란 테두리 강조 |
| 카드 추가 폼 열림 | `.btn-add-card` 숨김, `.add-card-form` 표시 |
| 카드 추가 폼 닫힘 | `.add-card-form` 숨김, `.btn-add-card` 표시 |

### 3.5 로그인 오버레이 (`.login-overlay`)

전체 화면을 덮는 반투명 배경 위에 중앙 정렬된 흰색 카드.

```
┌──────────────────────────────────────────────────────┐  ← .login-overlay
│           (rgba(0,0,0,0.55) 반투명 배경)             │    position:fixed, inset:0, z-index:1000
│                                                      │
│      ┌──────────────────────────────────┐            │  ← .login-card
│      │          칸반 보드               │            │    max-width:380px, padding:40px 36px
│      │   작업을 관리하려면 로그인하세요.│            │
│      │                                  │            │
│      │  [G_logo] Google로 로그인        │            │  ← .btn-oauth.btn-google
│      │  [GH_logo] GitHub로 로그인       │            │  ← .btn-oauth.btn-github
│      │                                  │            │
│      │  (에러 메시지)                   │            │  ← .login-error (hidden by default)
│      └──────────────────────────────────┘            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

| 항목 | 값 |
|------|-----|
| 오버레이 배경 | `var(--color-login-overlay-bg)` = `rgba(0,0,0,0.55)` |
| 카드 배경 | `var(--color-card-bg)` = `#ffffff` |
| 카드 border-radius | `var(--radius-column)` = 12px |
| 카드 box-shadow | `var(--shadow-login-card)` = `0 8px 32px rgba(0,0,0,0.18)` |
| Google 버튼 | 흰 배경 `#fff`, 회색 테두리 `#dadce0` |
| GitHub 버튼 | 검정 배경 `#24292f`, 흰 텍스트 |
| 버튼 border-radius | `var(--radius-card)` = 8px |
| 버튼 padding | `12px 20px` |

### 3.6 헤더 사용자 정보 (`.header-user`)

인증 후 헤더 우측에 표시. 미인증 시 `hidden` 속성으로 숨김.

```
┌──────────────────────────────────────────────────────────┐  ← header
│  칸반 보드              [아바타] user@email.com [로그아웃]│    flex, space-between
└──────────────────────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| `.user-avatar` | 32×32 원형 이미지, OAuth provider의 `avatar_url` |
| `.user-email` | 최대 200px, overflow ellipsis, `768px` 이하에서 숨김 |
| `.btn-signout` | 반투명 흰 배경, 흰 텍스트, hover 시 밝기 증가 |

---

## 6. 접근성

- 삭제 버튼: `aria-label="삭제"` 적용
- 입력 폼: `placeholder`로 힌트 제공
- 카드: `draggable="true"` 명시
- 향후: 키보드 드래그 지원 검토 (`role="listitem"`, arrow key 이동)
