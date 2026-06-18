# Database Design — 칸반보드

## 현재 구현 (Phase 3 — Supabase PostgreSQL)

> Phase 3에서 Supabase PostgreSQL을 사용하는 `cards` 테이블을 구현했다.  
> 컬럼이 3개로 고정된 현재 구조에서는 별도의 columns 테이블 없이  
> `column_name` 텍스트 필드로 컬럼을 구분한다.

---

## 1. 실제 구현 스키마

### 1.1 `cards` (구현됨)

사용자의 칸반 카드. Supabase Auth의 `auth.users`를 외래 키로 참조.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK, DEFAULT gen_random_uuid() | 카드 고유 ID |
| `user_id` | uuid | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | 소유 사용자 |
| `column_name` | text | NOT NULL, CHECK IN ('todo','inprogress','done') | 소속 컬럼 |
| `title` | varchar(50) | NOT NULL | 카드 제목 (최대 50자) |
| `description` | text | NULL | 카드 상세 설명 |
| `position` | integer | NOT NULL, DEFAULT 0 | 컬럼 내 표시 순서 |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | 생성일시 |

### 1.2 인덱스

```sql
CREATE INDEX idx_cards_user_column_position
  ON public.cards (user_id, column_name, position ASC, created_at ASC);
```

### 1.3 Row Level Security (RLS)

모든 데이터 접근은 RLS로 제어. 사용자는 자신의 카드만 접근 가능.

| 정책 이름 | 대상 | 조건 |
|-----------|------|------|
| `cards_select_own` | SELECT | `auth.uid() = user_id` |
| `cards_insert_own` | INSERT | `auth.uid() = user_id` |
| `cards_update_own` | UPDATE | `auth.uid() = user_id` |
| `cards_delete_own` | DELETE | `auth.uid() = user_id` |

### 1.4 DDL (전체 — `docs/supabase-schema.sql` 참조)

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

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
```

---

## 2. 향후 확장 스키마 (Phase 4+ 계획)

> 다중 보드, 동적 컬럼, 팀 협업 기능 구현 시 아래 스키마로 확장한다.

### 2.1 ERD (목표)

```
auth.users ──< boards ──< columns ──< cards
     │                                  │
     └──────── board_members ───────────┘
```

### 2.2 `boards`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `owner_id` | uuid | FK → auth.users(id) |
| `title` | varchar(200) | 보드 이름 |
| `created_at` | timestamptz | 생성일시 |

### 2.3 `columns`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `board_id` | uuid | FK → boards(id) |
| `name` | varchar(100) | 컬럼 이름 |
| `position` | integer | 표시 순서 |
| `created_at` | timestamptz | 생성일시 |

### 2.4 `cards` (확장)

현재 `column_name` 텍스트 필드를 `column_id` FK로 교체.

| 변경 | 현재 | 확장 후 |
|------|------|---------|
| 컬럼 식별 | `column_name text` | `column_id uuid FK→columns(id)` |
| 사용자 식별 | `user_id` (직접) | `created_by uuid FK→users(id)` |

### 2.5 `board_members`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `board_id` | uuid | PK(복합), FK → boards(id) |
| `user_id` | uuid | PK(복합), FK → auth.users(id) |
| `role` | text | 'admin' / 'member' / 'viewer' |
| `joined_at` | timestamptz | 참여일시 |

---

## 3. Phase 3 → Phase 4 마이그레이션 전략

1. `boards` 테이블 생성 → 기존 사용자당 기본 보드 1개 seed
2. `columns` 테이블 생성 → todo/inprogress/done 컬럼 3개 seed
3. `cards.column_name` → `cards.column_id` 마이그레이션 (컬럼명→UUID 매핑)
4. `app.js` loadCards 쿼리를 `boards/columns JOIN` 방식으로 교체
