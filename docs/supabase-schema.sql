-- ═══════════════════════════════════════════════════════════════
-- Supabase SQL Editor에서 실행: 칸반보드 cards 테이블 생성
-- ═══════════════════════════════════════════════════════════════

-- 1. cards 테이블 생성
CREATE TABLE public.cards (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_name  text          NOT NULL CHECK (column_name IN ('todo', 'inprogress', 'done')),
  title        varchar(50)   NOT NULL,
  description  text,
  position     integer       NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

-- 2. 인덱스 (사용자별 컬럼 조회 + 정렬 최적화)
CREATE INDEX idx_cards_user_column_position
  ON public.cards (user_id, column_name, position ASC, created_at ASC);

-- 3. Row Level Security 활성화
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 본인 카드만 접근
CREATE POLICY "cards_insert_own"
  ON public.cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ※ cards_select_own / cards_update_own / cards_delete_own 은
--   아래 Phase 4 공유 기능에서 확장 정책으로 대체됩니다.
CREATE POLICY "cards_select_own"
  ON public.cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "cards_update_own"
  ON public.cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_delete_own"
  ON public.cards FOR DELETE
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
-- Phase 4: 팀 공유 + 활동 로그
-- Supabase SQL Editor에서 아래 SQL을 이어서 실행하세요.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────
-- 5. board_shares 테이블 (보드 공유 멤버십)
-- ───────────────────────────────────────────
CREATE TABLE public.board_shares (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email  text        NOT NULL,
  member_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted')),
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  UNIQUE (owner_id, member_id)
);

-- ※ 이미 board_shares를 생성한 경우 아래를 실행하세요:
-- ALTER TABLE public.board_shares ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';

CREATE INDEX idx_board_shares_owner  ON public.board_shares (owner_id);
CREATE INDEX idx_board_shares_member ON public.board_shares (member_id, status);

ALTER TABLE public.board_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shares_select_owner"
  ON public.board_shares FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "shares_select_member"
  ON public.board_shares FOR SELECT
  USING (auth.uid() = member_id);

CREATE POLICY "shares_insert_owner"
  ON public.board_shares FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "shares_update_member"
  ON public.board_shares FOR UPDATE
  USING  (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "shares_delete_own"
  ON public.board_shares FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = member_id);


-- ───────────────────────────────────────────
-- 6. activity_logs 테이블 (카드 조작 이력)
-- ───────────────────────────────────────────
CREATE TABLE public.activity_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  board_owner_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email    text        NOT NULL,
  event_type     text        NOT NULL
                             CHECK (event_type IN ('card_added', 'card_deleted', 'card_moved')),
  card_title     text        NOT NULL,
  from_column    text,
  to_column      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_board
  ON public.activity_logs (board_owner_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select_participant"
  ON public.activity_logs FOR SELECT
  USING (
    auth.uid() = board_owner_id
    OR EXISTS (
      SELECT 1 FROM public.board_shares bs
      WHERE bs.owner_id = board_owner_id
        AND bs.member_id = auth.uid()
        AND bs.status = 'accepted'
    )
  );

CREATE POLICY "logs_insert_participant"
  ON public.activity_logs FOR INSERT
  WITH CHECK (
    auth.uid() = board_owner_id
    OR EXISTS (
      SELECT 1 FROM public.board_shares bs
      WHERE bs.owner_id = board_owner_id
        AND bs.member_id = auth.uid()
        AND bs.status = 'accepted'
    )
  );


-- ───────────────────────────────────────────
-- 7. cards RLS 확장 (멤버도 소유자 카드 접근 허용)
-- ───────────────────────────────────────────
DROP POLICY IF EXISTS "cards_select_own" ON public.cards;
DROP POLICY IF EXISTS "cards_update_own" ON public.cards;
DROP POLICY IF EXISTS "cards_delete_own" ON public.cards;

CREATE POLICY "cards_select_participant"
  ON public.cards FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.board_shares bs
      WHERE bs.owner_id = cards.user_id
        AND bs.member_id = auth.uid()
        AND bs.status = 'accepted'
    )
  );

CREATE POLICY "cards_update_participant"
  ON public.cards FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.board_shares bs
      WHERE bs.owner_id = cards.user_id
        AND bs.member_id = auth.uid()
        AND bs.status = 'accepted'
    )
  )
  WITH CHECK (user_id = user_id);

CREATE POLICY "cards_delete_participant"
  ON public.cards FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.board_shares bs
      WHERE bs.owner_id = cards.user_id
        AND bs.member_id = auth.uid()
        AND bs.status = 'accepted'
    )
  );


-- ───────────────────────────────────────────
-- 8. Security-Definer RPC: 이메일 → user_id 조회
--    (auth.users는 anon 키로 직접 조회 불가)
-- ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
