# 칸반 보드 — WORKFLOW

## 프로젝트 개요

팀원과 공유 가능한 칸반 보드입니다. 서버 없이 브라우저에서 직접 열 수 있으며, Supabase(PostgreSQL + Auth)를 백엔드로 사용합니다.

**기술 스택**
- Frontend: 순수 HTML / CSS / JavaScript (빌드 도구 없음)
- Backend: Supabase (DB, Auth, RLS, RPC)
- 인증: 이메일/비밀번호, Google OAuth, GitHub OAuth

---

## 실행 방법

```bash
# 브라우저에서 index.html을 직접 열기
open index.html          # macOS
xdg-open index.html      # Linux
# 또는 파일 탐색기에서 더블클릭
```

빌드 단계, 로컬 서버, 패키지 설치 모두 불필요합니다.

---

## 주요 기능

### 1. 인증
- 이메일/비밀번호 회원가입 및 로그인
- Google / GitHub OAuth (팝업 방식, 실패 시 리다이렉트 fallback)
- 이메일 중복 확인 (blur 이벤트)
- 세션 자동 복원 (새로고침 후에도 로그인 유지)

### 2. 칸반 보드
- 3컬럼 구조: **TO-DO** | **In-Progress** | **Done**
- 카드 추가 (컬럼별 "+카드 추가" 버튼)
- 카드 삭제 (hover 시 × 버튼)
- 드래그 앤 드롭으로 컬럼 간 이동
- 카드 수 실시간 업데이트

### 3. 팀 공유
- 헤더의 **공유** 버튼으로 모달 열기
- 이메일로 팀원 초대 (가입된 계정만 초대 가능)
- 초대 상태: 대기 중 / 수락됨
- 초대받은 사람은 로그인 후 상단 배너에서 **수락 / 거절** 선택
- 보드 선택 드롭다운으로 "내 보드" ↔ "팀원의 보드" 전환
- 소유자는 멤버를 언제든지 제거 가능

### 4. 활동 로그
- 헤더의 **활동 로그** 버튼으로 오른쪽 패널 열기
- 기록되는 이벤트: 카드 추가 / 삭제 / 이동
- 누가 언제 어떤 작업을 했는지 표시
- 공유 보드의 경우 소유자와 멤버 모두 조회 가능
- 최신 50개 이벤트 표시, 상대 시간 형식 (방금 전 / N분 전 / N시간 전)

---

## 파일 구조

```
kanban/
├── index.html           # 메인 HTML (UI 구조 전체)
├── style.css            # 전체 스타일
├── app.js               # 칸반 보드 로직 (공유, 로그 포함)
├── auth.js              # Supabase 인증 로직
├── config.js            # Supabase URL / anon key (git 제외)
├── config.example.js    # config.js 템플릿
├── WORKFLOW.md          # 이 파일
├── CLAUDE.md            # Claude Code 작업 지침
└── docs/
    ├── supabase-schema.sql  # DB 스키마 (Supabase SQL Editor에서 실행)
    ├── PRD.md               # 제품 요구사항
    ├── TRD.md               # 기술 요구사항
    ├── DatabaseDesign.md    # DB 설계 문서
    ├── DesignSystem.md      # 디자인 시스템
    ├── UserFlow.md          # 사용자 흐름도
    └── TASKS.md             # 작업 목록
```

---

## Supabase 설정 가이드

### 초기 설정 (신규)

1. [Supabase](https://supabase.com) 프로젝트 생성
2. `config.example.js`를 `config.js`로 복사 후 URL과 anon key 입력
3. Supabase SQL Editor에서 `docs/supabase-schema.sql` 전체 실행
4. (선택) Authentication > Providers에서 Google / GitHub 활성화

### 기존 프로젝트에 Phase 4 적용

`docs/supabase-schema.sql`의 **Phase 4** 섹션을 SQL Editor에서 실행합니다.  
이 섹션은 기존 `cards` 정책을 교체하고 `board_shares`, `activity_logs` 테이블을 추가합니다.

---

## 데이터베이스 스키마 요약

| 테이블 | 설명 |
|---|---|
| `cards` | 칸반 카드. `user_id`(소유자), `column_name`, `title`, `position` |
| `board_shares` | 보드 공유 멤버십. `owner_id`, `member_id`, `status(pending/accepted)` |
| `activity_logs` | 카드 조작 이력. `board_owner_id`, `actor_email`, `event_type` |

모든 테이블에 Row Level Security(RLS) 적용 — 인증된 사용자만 접근 가능.

---

## 개발 가이드라인

### 브랜치 전략
- 브랜치 통합은 **반드시 merge** 사용 (`rebase` 금지)
- 기능 브랜치: `feat/기능명`
- 버그 수정: `fix/버그명`

### 코딩 컨벤션
- `app.js`: IIFE로 전체 감싸기 (전역 오염 방지)
- 이벤트는 `.kanban-board`에 위임 처리 (성능)
- `dragging` 클래스는 `requestAnimationFrame` 안에서 추가
- `dragleave` 오발화 방지: `e.relatedTarget`이 `.card-list` 내부일 때는 `.drag-over` 유지

### 검증
- Playwright 사용 금지
- `index.html`을 브라우저에서 직접 열어 수동 확인
- 주요 시나리오: 카드 CRUD, 드래그 앤 드롭, 초대 흐름, 활동 로그

---

## 주요 흐름 다이어그램

### 팀 공유 흐름

```
사용자 A (소유자)                사용자 B (멤버)
      |                               |
  로그인 완료                         |
      |                               |
  [공유] 클릭                         |
  이메일 입력 → 초대 전송              |
  board_shares INSERT (pending)       |
      |                          로그인 완료
      |                          초대 배너 표시
      |                          [수락] 클릭
      |                          board_shares UPDATE (accepted)
      |                               |
      |                          보드 선택 드롭다운에
      |                          "A의 보드" 추가됨
      |                               |
      |                          A의 보드 전환 → 카드 조작
      |                               |
  활동 로그 확인 ←────────────── activity_logs INSERT
```

### 활동 로그 기록 시점

| 동작 | 기록 타이밍 |
|---|---|
| 카드 추가 | DB insert 성공 후 |
| 카드 삭제 | DB delete 성공 후 |
| 카드 이동 | DB update 성공 후 |
