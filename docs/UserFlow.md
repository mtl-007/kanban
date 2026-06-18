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

## 2. 카드 추가 플로우

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
       카드 DOM 생성 (createCard)
          │
          ▼
       해당 컬럼 .card-list에 추가
          │
          ▼
       폼 숨김 / 버튼 복원
          │
          ▼
       카운터 갱신 (updateCardCounts)
```

---

## 3. 카드 이동 플로우 (드래그 앤 드롭)

```
카드 위에서 마우스 버튼 누름 (dragstart)
        │
        ▼
draggedCard 참조 저장
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
카드 이동
(appendChild)
   │
   ▼
.drag-over 제거
   │
   ▼
카운터 갱신
        │
        ▼ (dragend — 어디서 끝나든)
.dragging 클래스 제거
draggedCard = null
```

---

## 4. 카드 삭제 플로우

```
카드의 [×] 버튼 클릭
        │
        ▼
이벤트 위임: .kanban-board click 핸들러
        │
        ▼
.card-delete 클래스 확인
        │
        ▼
card.remove()
        │
        ▼
카운터 갱신 (updateCardCounts)
```

---

## 5. Phase 2 — 인증 플로우 (구현됨)

### 5.1 최초 접속 (비로그인)

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

### 5.2 OAuth 로그인

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

### 5.3 세션 복원 (새로고침)

```
페이지 로드
    │
    ▼
auth.js: getSession() → localStorage에 유효한 세션 존재
    │
    ▼
updateHeaderUser() + showBoard() — 로그인 화면 없이 보드 즉시 표시
```

### 5.4 로그아웃

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
