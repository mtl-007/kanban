# User Flow — 칸반보드

## 1. 전체 흐름 개요

```
브라우저에서 index.html 열기
        │
        ▼
  auth.js: 세션 확인 (getSession)
        │
   ┌────┴──────────────┐
   │                   │
세션 없음           세션 있음
   │                   │
   ▼                   ▼
로그인 오버레이      보드 화면 진입
표시               (TO-DO / In-Progress / Done)
   │                   │
OAuth 로그인        ┌──┴──────────────┐
   │                │                 │
   ▼              카드 추가         카드 조작
세션 생성         (폼 입력)     (이동/삭제/드래그)
   │                │                 │
   ▼                └────────┬────────┘
보드 화면 진입               ▼
                       카운터 자동 갱신
```

---

## 2. 카드 추가 플로우 (Phase 3 — DB 저장)

```
컬럼 하단 [+ 카드 추가] 클릭
        │
        ▼
입력 폼 표시 / [+ 카드 추가] 버튼 숨김
        │
   ┌────┴──────────────┐
   │                   │
제목 입력 후          [취소] 클릭
[추가] 클릭               │
   │                   ▼
   │           폼 숨김 / 입력 초기화
   │           [+ 카드 추가] 버튼 복원
   ▼
제목 공백 검사
   │
   ├─── 공백이면 → 추가 안 함 (폼 유지)
   │
   └─── 유효하면
          │
          ▼
       [추가] 버튼 비활성화 ("저장 중...")
          │
          ▼
       Supabase INSERT cards
       (user_id, column_name, title, position)
          │
     ┌────┴────────┐
     │             │
   성공           실패
     │             │
     ▼             ▼
  카드 DOM 생성  버튼 복원
  (.card-list)  (에러 콘솔)
     │
     ▼
  폼 숨김 / 버튼 복원
     │
     ▼
  카운터 갱신 (updateCardCounts)
```

---

## 3. 카드 이동 플로우 (Phase 3 — DB 반영)

```
카드 위에서 마우스 버튼 누름 (dragstart)
        │
        ▼
draggedCard, draggedCardId(UUID) 저장
requestAnimationFrame → .dragging 클래스 적용
        │
        ▼
다른 컬럼의 카드 목록 위로 드래그 (dragover)
        │
        ▼
대상 컬럼에 .drag-over 하이라이트
        │
   ┌────┴──────────────┐
   │                   │
드롭 (drop)         같은 컬럼에 드롭
   │                   │
   ▼                   ▼
다른 컬럼이면       이동 없음
 DOM 이동 (낙관적 업데이트)
   │
   ▼
.drag-over 제거 + 카운터 갱신
   │
   ▼ (비동기)
Supabase UPDATE cards
SET column_name = 새 컬럼, position = MAX+1
        │
        ▼ (dragend — 어디서 끝나든)
.dragging 클래스 제거
draggedCard = null, draggedCardId = null
```

---

## 4. 카드 삭제 플로우 (Phase 3 — DB 반영)

```
카드의 [×] 버튼 클릭
        │
        ▼
이벤트 위임: .kanban-board click 핸들러
        │
        ▼
card.dataset.cardId (UUID) 추출
        │
        ▼
Supabase DELETE cards WHERE id = UUID
        │
   ┌────┴────────┐
   │             │
 성공           실패
   │             │
   ▼             ▼
card.remove()  에러 콘솔
   │
   ▼
카운터 갱신 (updateCardCounts)
```

---

## 5. Phase 3 — 카드 데이터 로드 플로우 (구현됨)

### 5.1 로그인 후 카드 로드

```
showBoard() 호출 (auth.js)
    │
    ▼
boardVisible 플래그 확인
    │
    ├─── 이미 true → 중단 (중복 로드 방지)
    │
    └─── false → true로 설정
              │
              ▼
         window.initBoard() 호출 (= app.js loadCards)
              │
              ▼
         기존 .card DOM 초기화
              │
              ▼
         Supabase SELECT cards
         WHERE user_id = auth.uid()
         ORDER BY position ASC, created_at ASC
              │
         ┌───┴──────────┐
         │              │
       성공            실패
         │              │
         ▼              ▼
      컬럼별 DOM      에러 콘솔
      렌더링          (보드는 빈 상태)
         │
         ▼
      updateCardCounts()
```

### 5.2 새로고침 시 카드 유지

```
페이지 새로고침
    │
    ▼
auth.js getSession() → localStorage 세션 존재
    │
    ▼
showBoard() → initBoard() → loadCards()
    │
    ▼
이전에 저장된 카드 그대로 표시
```

---

## 6. Phase 2 — 인증 플로우 (구현됨)

### 6.1 최초 접속 (비로그인)

```
페이지 로드
    │
    ▼
auth.js: getSession() → 세션 없음
    │
    ▼
showLogin()
  └─ login-overlay.hidden = false  (로그인 오버레이 표시)
  └─ kanban-board.hidden = true    (보드 숨김)
  └─ header-user.hidden = true     (사용자 정보 숨김)
```

### 6.2 OAuth 로그인

```
[Google로 로그인] 또는 [GitHub로 로그인] 클릭
    │
    ▼
signInWithOAuth({
  provider: 'google' | 'github',
  redirectTo: window.location.origin + window.location.pathname
})
    │
    ▼
Supabase → OAuth 제공자 페이지 리다이렉트
    │
    ▼
사용자 권한 승인
    │
    ▼
GitHub Pages URL로 복귀 (URL 해시에 토큰 포함)
    │
    ▼
Supabase SDK: onAuthStateChange('SIGNED_IN', session) 발화
    │
    ▼
updateHeaderUser(session.user)
  └─ user-avatar src = user_metadata.avatar_url
  └─ user-email textContent = user.email
  └─ header-user.hidden = false
    │
    ▼
showBoard()
  └─ login-overlay.hidden = true   (오버레이 숨김)
  └─ kanban-board.hidden = false   (보드 표시)
```

### 6.3 세션 복원 (새로고침)

```
페이지 로드
    │
    ▼
auth.js: getSession() → localStorage에 유효한 세션 존재
    │
    ▼
updateHeaderUser() + showBoard() — 로그인 화면 없이 보드 즉시 표시
```

### 6.4 로그아웃

```
헤더 [로그아웃] 클릭
    │
    ▼
supabase.auth.signOut()
  └─ localStorage 토큰 삭제
    │
    ▼
showLogin() — 칸반 보드 숨김 / 로그인 오버레이 표시
```
