# TRD — 칸반보드 기술 설계서

## 1. 기술 스택

### Phase 1 (완료)
| 레이어 | 기술 |
|--------|------|
| 마크업 | HTML5 |
| 스타일 | CSS3 (Flexbox, Custom Properties) |
| 로직 | Vanilla JavaScript (ES6+) |
| 런타임 | 브라우저 직접 실행 (서버 없음) |

### Phase 2 (완료 — 인증)
| 레이어 | 기술 |
|--------|------|
| 인증 | Supabase Auth (OAuth 2.0 — Google, GitHub) |
| 클라이언트 SDK | @supabase/supabase-js v2 (CDN UMD 빌드) |
| 세션 스토리지 | localStorage (Supabase SDK 자동 관리) |
| 배포 | GitHub Pages |

### Phase 3 (완료 — 데이터 영속성)
| 레이어 | 기술 |
|--------|------|
| 데이터베이스 | Supabase PostgreSQL |
| 데이터 접근 | Supabase REST API (supabase-js 클라이언트) |
| 보안 | Row Level Security (RLS) — 사용자 본인 카드만 접근 |

### Phase 4+ (계획)
| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | 현행 유지 또는 React/Vue 전환 |
| 기능 | 카드 설명 편집, 다중 보드, 실시간 협업 |

---

## 2. 파일 구조

```
kanban/
├── index.html          # 보드 구조, 로그인 오버레이 (카드는 JS로 동적 렌더링)
├── style.css           # 레이아웃, 컬럼 색상, 드래그 피드백, 로그인 UI, 반응형
├── config.js           # Supabase URL + anon key (커밋됨, 공개 안전 키)
├── config.example.js   # config.js 템플릿 (플레이스홀더 값)
├── auth.js             # Supabase 클라이언트, OAuth 로그인/로그아웃, 세션 관리
├── app.js              # 드래그&드롭, 카드 CRUD (Supabase DB 연동), 카운터 로직
├── plan.md             # 구현 설계 메모
└── docs/               # 설계 문서 모음
    └── supabase-schema.sql  # cards 테이블 DDL + RLS 정책
```

---

## 3. 핵심 구현 상세

### 3.1 드래그 앤 드롭

```
dragstart (위임: .kanban-board)
  └─ draggedCard, draggedCardId(UUID) 참조 저장
  └─ requestAnimationFrame → .dragging 클래스 추가
       ※ 다음 프레임에 추가해야 고스트 이미지 정상 렌더링

dragend (위임: .kanban-board)
  └─ .dragging 제거, draggedCard = null, draggedCardId = null

dragover (.card-list 각각)
  └─ e.preventDefault() 필수 (드롭 허용)
  └─ 컬럼에 .drag-over 추가

dragleave (.card-list 각각)
  └─ e.relatedTarget이 .card-list 내부이면 무시 (오발화 방지)

drop (.card-list 각각)
  └─ draggedCard.closest('.card-list') !== list 확인 후 이동
  └─ DOM 이동 (낙관적 업데이트)
  └─ updateCardColumn(draggedCardId, newColumnName) — DB 반영 (비동기)
  └─ updateCardCounts() 호출
```

### 3.2 모듈 스코프

- 전체 코드를 IIFE(`(() => { ... })()`)로 감싸 전역 오염 방지
- `window.initBoard = loadCards` 로 auth.js와의 연결 진입점만 전역 노출

### 3.3 카드 생성 및 ID 관리

- Phase 3부터 카드 ID는 Supabase UUID(`gen_random_uuid()`)를 사용
- DOM 요소에 `data-card-id` 속성으로 UUID 바인딩
- `createCardElement(card)` → DB 응답 객체를 받아 DOM 요소 반환

### 3.4 이벤트 위임

- 카드 삭제 클릭 및 드래그 이벤트는 `.kanban-board` 한 곳에 위임
- 동적으로 추가된 카드에도 별도 리스너 불필요

### 3.5 카드 수 배지

- `updateCardCounts()` — 각 `.column` 내 `.card` 수 집계 후 `.card-count` 갱신
- 카드 추가 / 삭제 / 드롭 직후 호출

---

## 4. 인증 아키텍처 (Phase 2 — 구현됨)

### 4.1 스크립트 로드 순서

```html
<!-- 실행 순서: CDN → config.js → auth.js → app.js (모두 defer) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
<script src="config.js" defer></script>
<script src="auth.js" defer></script>
<script src="app.js" defer></script>
```

- `defer`: HTML 파싱 완료 후 선언 순서대로 실행 보장
- `config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 상수를 `auth.js`가 읽으므로 순서 필수

### 4.2 인증 흐름

```
페이지 로드
  └─ auth.js DOMContentLoaded
       ├─ onAuthStateChange 리스너 등록 (OAuth 콜백 처리)
       └─ getSession() → 기존 세션 확인
            ├─ 세션 있음 → updateHeaderUser() + showBoard() → initBoard()
            └─ 세션 없음 → showLogin()

로그인 버튼 클릭
  └─ signInWithOAuth({ provider, redirectTo: origin+pathname })
       └─ Supabase → OAuth 제공자 리다이렉트
            └─ 사용자 승인 → 앱 URL로 복귀
                 └─ onAuthStateChange('SIGNED_IN') 발화
                      └─ updateHeaderUser() + showBoard() → initBoard()

로그아웃 클릭
  └─ supabase.auth.signOut()
       └─ localStorage 토큰 삭제 → showLogin() (boardVisible 리셋)
```

### 4.3 중복 initBoard 방지

```javascript
let boardVisible = false;

function showBoard() {
  if (boardVisible) return;   // getSession + onAuthStateChange 중복 방지
  boardVisible = true;
  // ... UI 전환 ...
  window.initBoard();
}

function showLogin() {
  boardVisible = false;       // 로그아웃 후 재로그인 시 재초기화 허용
  // ...
}
```

### 4.4 세션 관리

- Supabase SDK가 `localStorage`에 토큰 자동 저장/갱신
- `getSession()` 호출로 페이지 새로고침 시 세션 즉시 복원
- 보안: anon key는 공개 안전 키. 데이터 접근은 Supabase RLS 정책으로 제어

### 4.5 Redirect URL 결정 방식

```javascript
// 로컬 개발(http://localhost)과 GitHub Pages 환경 자동 감지
// pathname이 '/'이면 trailing slash 제거 (Supabase Redirect URL 정확 매칭)
function getRedirectTo() {
  const { origin, pathname } = window.location;
  const path = pathname === '/' ? '' : pathname.replace(/\/$/, '');
  return origin + path;
}
```

### 4.6 Supabase Dashboard 필수 설정

| 위치 | 항목 | 값 |
|------|------|-----|
| Authentication > Providers > Google | 활성화 + Client ID/Secret | Google Cloud Console OAuth 앱 |
| Authentication > Providers > GitHub | 활성화 + Client ID/Secret | GitHub Developer Settings OAuth 앱 |
| Authentication > URL Configuration > Site URL | `https://mtl-007.github.io/kanban` | |
| Authentication > URL Configuration > Redirect URLs | `https://mtl-007.github.io/kanban`, `http://localhost:5500` | |

---

## 5. 데이터 아키텍처 (Phase 3 — 구현됨)

### 5.1 cards 테이블 스키마

```sql
CREATE TABLE public.cards (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_name  text          NOT NULL CHECK (column_name IN ('todo', 'inprogress', 'done')),
  title        varchar(50)   NOT NULL,
  description  text,
  position     integer       NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now()
);
```

### 5.2 Row Level Security (RLS) 정책

| 정책 | 대상 | 조건 |
|------|------|------|
| `cards_select_own` | SELECT | `auth.uid() = user_id` |
| `cards_insert_own` | INSERT | `auth.uid() = user_id` |
| `cards_update_own` | UPDATE | `auth.uid() = user_id` |
| `cards_delete_own` | DELETE | `auth.uid() = user_id` |

### 5.3 카드 CRUD 흐름

| 동작 | DB 호출 | DOM 처리 |
|------|---------|---------|
| 로드 | `SELECT * ORDER BY position, created_at` | 컬럼별 렌더링 |
| 추가 | `INSERT ... RETURNING *` | 응답 카드로 DOM 생성 |
| 삭제 | `DELETE WHERE id = $1` | 성공 후 DOM 제거 |
| 이동 | `UPDATE SET column_name, position WHERE id = $1` | 드롭 즉시 DOM 이동 (낙관적 업데이트) |

### 5.4 position 관리

- 새 카드/이동 시: 대상 컬럼의 `MAX(position) + 1` 부여
- 조회 시: `position ASC, created_at ASC` 정렬로 사용자가 배치한 순서 유지

---

## 6. 브라우저 지원

| 브라우저 | 최소 버전 |
|----------|-----------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## 7. 성능 고려사항

- 정적 파일만 사용하므로 번들링 불필요
- 카드 목록이 100개 이상일 경우 가상 스크롤 또는 페이지네이션 검토 (Phase 4+)
- 실시간 협업 시 Supabase Realtime(WebSocket) 도입 검토 (Phase 4+)
