# TASKS — 칸반보드

## Phase 1: 정적 MVP (현재)

### 완료 ✅

- [x] 3컬럼 보드 레이아웃 구현 (TO-DO / In-Progress / Done)
- [x] 카드 드래그 앤 드롭 (HTML5 DnD API)
  - [x] dragstart / dragend 처리
  - [x] dragover / dragleave / drop 처리
  - [x] `.dragging` 클래스 requestAnimationFrame 적용
  - [x] dragleave 오발화 방지 처리
- [x] 카드 추가 (폼 토글 + 유효성 검사)
- [x] 카드 삭제 (이벤트 위임)
- [x] 카드 수 배지 자동 갱신
- [x] 반응형 레이아웃 (768px 이하 세로 배치)
- [x] 초기 샘플 카드 6장 삽입

---

## Phase 2: 사용자 인증 (Supabase OAuth)

### 완료 ✅

- [x] `config.js` — Supabase URL + anon key 설정 파일
- [x] `config.example.js` — 설정 파일 템플릿 (커밋용 참고 파일)
- [x] `auth.js` — Supabase 클라이언트, OAuth 로그인/로그아웃, 세션 관리, UI 전환
- [x] `index.html` — 로그인 오버레이 HTML, 헤더 사용자 정보 슬롯, CDN 스크립트 추가
- [x] `style.css` — 로그인 오버레이 스타일, 헤더 flex 레이아웃, 사용자 정보 스타일
- [x] GitHub Pages 배포 구조 준비 (개인 레포 `kanban` 기준)

### 수동 설정 필요 (Supabase Dashboard)

- [ ] Authentication > Providers > Google: 활성화 + Client ID/Secret 입력
- [ ] Authentication > Providers > GitHub: 활성화 + Client ID/Secret 입력
- [ ] Authentication > URL Configuration > Site URL 설정
- [ ] Authentication > URL Configuration > Redirect URLs 추가

### 수동 설정 필요 (GitHub)

- [ ] 개인 레포 `kanban` 생성 후 코드 push
- [ ] Settings > Pages > main 브랜치 `/root`에서 서비스 활성화

---

## Phase 3: 데이터 영속성 (Supabase DB)

### 완료 ✅

- [x] `docs/supabase-schema.sql` — cards 테이블 DDL + RLS 4개 정책
- [x] `app.js` DOM 직접 조작 → Supabase DB CRUD로 교체
  - [x] `loadCards()` — 로그인 후 사용자 카드 전체 로드 및 렌더링
  - [x] `saveNewCard()` — 카드 추가 시 DB insert, 저장 중 버튼 비활성화
  - [x] `removeCard()` — 카드 삭제 시 DB delete
  - [x] `updateCardColumn()` — 드래그 이동 시 DB column_name 업데이트
  - [x] `window.initBoard = loadCards` 노출 (auth.js에서 showBoard 후 호출)
- [x] `auth.js` — `boardVisible` 플래그로 중복 initBoard 호출 방지
- [x] `index.html` — 정적 샘플 카드 6개 제거 (DB에서 동적 로드)
- [x] 카드 DOM ID를 Supabase UUID 기반으로 전환 (`data-card-id`)
- [x] RLS 정책: 사용자 본인 카드만 SELECT / INSERT / UPDATE / DELETE

### 수동 설정 필요 (Supabase Dashboard)

- [ ] SQL Editor에서 `docs/supabase-schema.sql` 실행

---

## Phase 4: 협업 & UX 개선

### 기능

- [ ] 카드 설명(description) 편집 모달
- [ ] 컬럼 내 카드 순서 변경 (드래그 정렬)
- [ ] 다중 보드 지원 (보드 목록 페이지)
- [ ] 보드 멤버 초대 (`board_members`)
- [ ] 실시간 협업 (WebSocket / SSE 검토)

### UX

- [ ] 삭제 확인 다이얼로그
- [ ] 카드 추가 시 애니메이션
- [ ] 키보드 접근성 (드래그 키보드 대체)
- [ ] 다크 모드

---

## 기술 부채 / 개선 사항

- [x] 카드 DOM 구조에 `card-desc` 요소가 HTML에는 있으나 `createCard()`에서 생성 시 누락 — `createCard(title, desc='')` 로 수정 완료
- [x] `cardIdCounter` 전역 변수를 모듈 스코프로 감싸기 — IIFE로 전환 완료
- [x] CSS Custom Properties로 색상 변수화 — `:root` 블록 추가 완료
