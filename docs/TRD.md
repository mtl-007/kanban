# TRD — 칸반보드 기술 설계서

## 1. 기술 스택

### Phase 1 (완료)
| 레이어 | 기술 |
|--------|------|
| 마크업 | HTML5 |
| 스타일 | CSS3 (Flexbox, Custom Properties) |
| 로직 | Vanilla JavaScript (ES6+) |
| 런타임 | 브라우저 직접 실행 (서버 없음) |

### Phase 2 (현재 — 인증)
| 레이어 | 기술 |
|--------|------|
| 인증 | Supabase Auth (OAuth 2.0 — Google, GitHub) |
| 클라이언트 SDK | @supabase/supabase-js v2 (CDN UMD 빌드) |
| 세션 스토리지 | localStorage (Supabase SDK 자동 관리) |
| 배포 | GitHub Pages |

### Phase 3+ (계획)
| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | 현행 유지 또는 React/Vue 전환 |
| 백엔드 API | Node.js(Express) 또는 Python(FastAPI) |
| 데이터베이스 | MySQL 또는 PostgreSQL |

---

## 2. 파일 구조

```
kanban/
├── index.html          # 보드 구조, 로그인 오버레이, 초기 샘플 카드
├── style.css           # 레이아웃, 컬럼 색상, 드래그 피드백, 로그인 UI, 반응형
├── config.js           # Supabase URL + anon key (커밋됨, 공개 안전 키)
├── config.example.js   # config.js 템플릿 (플레이스홀더 값)
├── auth.js             # Supabase 클라이언트, OAuth 로그인/로그아웃, 세션 관리
├── app.js              # 드래그&드롭, 카드 CRUD, 카운터 로직
├── plan.md             # 구현 설계 메모
└── docs/               # 설계 문서 모음
```

---

## 3. 핵심 구현 상세

### 3.1 드래그 앤 드롭

```
dragstart (위임: .kanban-board)
  └─ draggedCard 참조 저장
  └─ requestAnimationFrame → .dragging 클래스 추가
       ※ 다음 프레임에 추가해야 고스트 이미지 정상 렌더링

dragend (위임: .kanban-board)
  └─ .dragging 제거, draggedCard = null

dragover (.card-list 각각)
  └─ e.preventDefault() 필수 (드롭 허용)
  └─ 컬럼에 .drag-over 추가

dragleave (.card-list 각각)
  └─ e.relatedTarget이 .card-list 내부이면 무시 (오발화 방지)

drop (.card-list 각각)
  └─ draggedCard.closest('.card-list') !== list 확인 후 이동
  └─ updateCardCounts() 호출
```

### 3.2 모듈 스코프

- 전체 코드를 IIFE(`(() => { ... })()`)로 감싸 `draggedCard`, `cardIdCounter`의 전역 노출을 방지

### 3.3 카드 생성

- `cardIdCounter`(초기값 100)를 증분하여 `id="card-{n}"` 부여
- `createCard(title, desc = '')` → DOM 요소 반환 → `.card-list`에 `appendChild`
  - `desc`가 빈 문자열이면 `.card-desc` 요소를 생성하지 않음
- Phase 2에서 API 응답의 `card.id`로 교체 예정

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
            ├─ 세션 있음 → updateHeaderUser() + showBoard()
            └─ 세션 없음 → showLogin()

로그인 버튼 클릭
  └─ signInWithOAuth({ provider, redirectTo: origin+pathname })
       └─ Supabase → OAuth 제공자 리다이렉트
            └─ 사용자 승인 → GitHub Pages URL로 복귀
                 └─ onAuthStateChange('SIGNED_IN') 발화
                      └─ updateHeaderUser() + showBoard()

로그아웃 클릭
  └─ supabase.auth.signOut()
       └─ localStorage 토큰 삭제 → showLogin()
```

### 4.3 세션 관리

- Supabase SDK가 `localStorage`에 토큰 자동 저장/갱신
- `getSession()` 호출로 페이지 새로고침 시 세션 즉시 복원
- 보안: anon key는 공개 안전 키. 데이터 접근은 Supabase RLS 정책으로 제어

### 4.4 Redirect URL 결정 방식

```javascript
// 로컬 개발(http://localhost)과 GitHub Pages 환경 자동 감지
function getRedirectTo() {
  return window.location.origin + window.location.pathname;
}
```

### 4.5 Supabase Dashboard 필수 설정

| 위치 | 항목 | 값 |
|------|------|-----|
| Authentication > Providers > Google | 활성화 + Client ID/Secret | Google Cloud Console OAuth 앱 |
| Authentication > Providers > GitHub | 활성화 + Client ID/Secret | GitHub Developer Settings OAuth 앱 |
| Authentication > URL Configuration > Site URL | `https://<username>.github.io/kanban/` | |
| Authentication > URL Configuration > Redirect URLs | `https://<username>.github.io/kanban/` | |

---

## 5. Phase 3+ API 설계 (선행 정의)

RESTful 엔드포인트 예시 (Phase 3+ 백엔드 연동 시 기준점):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/boards/:id` | 보드 정보 + 컬럼 + 카드 조회 |
| POST | `/api/cards` | 카드 생성 |
| PATCH | `/api/cards/:id` | 카드 수정 (제목, 컬럼, 순서) |
| DELETE | `/api/cards/:id` | 카드 삭제 |

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

- 정적 파일만 사용하므로 번들링 불필요 (Phase 1)
- Phase 2에서 카드 목록이 100개 이상일 경우 가상 스크롤 또는 페이지네이션 검토
- 실시간 협업 시 WebSocket 또는 SSE 도입 검토
