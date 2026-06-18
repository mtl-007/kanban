# Database Design — 칸반보드

> **현재(Phase 1)**: 데이터베이스 없음. 브라우저 메모리에만 존재하며 새로 고침 시 초기화됨.  
> **Phase 2+**: MySQL 또는 PostgreSQL 연동을 목표로 아래 스키마를 선행 설계함.

---

## 1. ERD (개념)

```
users ──< boards ──< columns ──< cards
  │                                │
  └──── board_members ─────────────┘
```

---

## 2. 테이블 정의

### 2.1 `users`

사용자 계정 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 사용자 ID |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | 로그인 이메일 |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt 해시 |
| `display_name` | VARCHAR(100) | NOT NULL | 표시 이름 |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | 가입일시 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT NOW() ON UPDATE NOW() | 수정일시 |

---

### 2.2 `boards`

칸반보드 단위.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 보드 ID |
| `owner_id` | BIGINT UNSIGNED | FK → users.id, NOT NULL | 소유자 |
| `title` | VARCHAR(200) | NOT NULL | 보드 이름 |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | 생성일시 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT NOW() ON UPDATE NOW() | 수정일시 |

---

### 2.3 `columns`

보드 내 컬럼(TO-DO, In-Progress, Done 등).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 컬럼 ID |
| `board_id` | BIGINT UNSIGNED | FK → boards.id, NOT NULL | 소속 보드 |
| `name` | VARCHAR(100) | NOT NULL | 컬럼 이름 |
| `position` | SMALLINT UNSIGNED | NOT NULL, DEFAULT 0 | 표시 순서 |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | 생성일시 |

> `position`은 컬럼 순서 변경을 위해 사용. (position ASC 정렬)

---

### 2.4 `cards`

컬럼 내 카드.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | 카드 ID |
| `column_id` | BIGINT UNSIGNED | FK → columns.id, NOT NULL | 소속 컬럼 |
| `title` | VARCHAR(50) | NOT NULL | 카드 제목 (최대 50자) |
| `description` | TEXT | NULL | 카드 상세 설명 |
| `position` | INT UNSIGNED | NOT NULL, DEFAULT 0 | 컬럼 내 순서 |
| `created_by` | BIGINT UNSIGNED | FK → users.id, NULL | 생성자 |
| `created_at` | DATETIME | NOT NULL, DEFAULT NOW() | 생성일시 |
| `updated_at` | DATETIME | NOT NULL, DEFAULT NOW() ON UPDATE NOW() | 수정일시 |

> 카드 이동(컬럼 변경): `column_id` 업데이트.  
> 컬럼 내 순서 변경: `position` 업데이트.

---

### 2.5 `board_members` (Phase 2+ 협업 기능)

보드 공유 멤버.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `board_id` | BIGINT UNSIGNED | PK(복합), FK → boards.id | 보드 |
| `user_id` | BIGINT UNSIGNED | PK(복합), FK → users.id | 멤버 |
| `role` | ENUM('admin','member','viewer') | NOT NULL, DEFAULT 'member' | 권한 |
| `joined_at` | DATETIME | NOT NULL, DEFAULT NOW() | 참여일시 |

---

## 3. 인덱스

```sql
-- cards: 컬럼별 카드 목록 조회 (position 정렬 포함)
CREATE INDEX idx_cards_column_position ON cards (column_id, position);

-- columns: 보드별 컬럼 조회
CREATE INDEX idx_columns_board_position ON columns (board_id, position);

-- board_members: 사용자별 보드 목록 조회
CREATE INDEX idx_board_members_user ON board_members (user_id);
```

---

## 4. DDL (MySQL / PostgreSQL 공통 기준)

```sql
CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255)    NOT NULL UNIQUE,
  password_hash VARCHAR(255)    NOT NULL,
  display_name  VARCHAR(100)    NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE boards (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id   BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(200)    NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE columns (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  board_id   BIGINT UNSIGNED  NOT NULL,
  name       VARCHAR(100)     NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  INDEX idx_columns_board_position (board_id, position)
);

CREATE TABLE cards (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  column_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(50)     NOT NULL,
  description TEXT,
  position    INT UNSIGNED    NOT NULL DEFAULT 0,
  created_by  BIGINT UNSIGNED,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (column_id)  REFERENCES columns(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_cards_column_position (column_id, position)
);

CREATE TABLE board_members (
  board_id  BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  role      ENUM('admin','member','viewer') NOT NULL DEFAULT 'member',
  joined_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (board_id, user_id),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  INDEX idx_board_members_user (user_id)
);
```

> PostgreSQL 사용 시: `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`, `ON UPDATE CURRENT_TIMESTAMP` → 트리거로 대체.

---

## 5. Phase 1 → Phase 2 마이그레이션 전략

1. 현재 HTML에 하드코딩된 초기 카드 6장을 DB seed 데이터로 이관
2. `app.js`의 직접 DOM 조작 로직을 API 호출로 교체
3. `cardIdCounter` 방식 대신 DB의 AUTO_INCREMENT id 사용
4. LocalStorage를 임시 캐시로 활용하다가 API 안정화 후 제거 가능
