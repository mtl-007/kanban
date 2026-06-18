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
CREATE POLICY "cards_select_own"
  ON public.cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "cards_insert_own"
  ON public.cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_update_own"
  ON public.cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_delete_own"
  ON public.cards FOR DELETE
  USING (auth.uid() = user_id);
