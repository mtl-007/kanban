// ─── Supabase 클라이언트 초기화 ───
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── OAuth 리다이렉트 URL ───
// 로컬 개발과 GitHub Pages 환경을 자동으로 감지
// pathname이 '/' 인 경우 trailing slash를 제거해 Supabase Redirect URL과 정확히 일치시킴
function getRedirectTo() {
  const { origin, pathname } = window.location;
  const path = pathname === '/' ? '' : pathname.replace(/\/$/, '');
  return origin + path;
}

// ─── UI 상태 전환 ───
function showLogin() {
  document.getElementById('login-overlay').hidden = false;
  document.querySelector('.kanban-board').hidden = true;
  document.getElementById('header-user').hidden = true;
}

function showBoard() {
  document.getElementById('login-overlay').hidden = true;
  document.querySelector('.kanban-board').hidden = false;
}

function updateHeaderUser(user) {
  const avatarUrl = user.user_metadata?.avatar_url ?? '';
  const displayName = user.email ?? user.user_metadata?.full_name ?? '';
  document.getElementById('user-avatar').src = avatarUrl;
  document.getElementById('user-email').textContent = displayName;
  document.getElementById('header-user').hidden = false;
}

// ─── 에러 표시 ───
function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('login-error');
  el.textContent = '';
  el.hidden = true;
}

// ─── OAuth 로그인 ───
async function signInWithGoogle() {
  clearError();
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectTo() },
  });
  if (error) showError(error.message);
}

async function signInWithGitHub() {
  clearError();
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: getRedirectTo() },
  });
  if (error) showError(error.message);
}

// ─── 로그아웃 ───
async function signOut() {
  await supabaseClient.auth.signOut();
  showLogin();
}

// ─── 초기화 ───
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-google').addEventListener('click', signInWithGoogle);
  document.getElementById('btn-github').addEventListener('click', signInWithGitHub);
  document.getElementById('btn-signout').addEventListener('click', signOut);

  // OAuth 콜백 포함, 세션 변경 감지
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      updateHeaderUser(session.user);
      showBoard();
    } else {
      showLogin();
    }
  });

  // 새로고침 시 기존 세션 즉시 복원 (로그인 화면 깜빡임 방지)
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      updateHeaderUser(session.user);
      showBoard();
    } else {
      showLogin();
    }
  });
});
