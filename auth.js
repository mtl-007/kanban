// ─── Supabase 클라이언트 초기화 ───
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── OAuth 리다이렉트 URL ───
// pathname이 '/' 인 경우 trailing slash를 제거해 Supabase Redirect URL과 정확히 일치시킴
function getRedirectTo() {
  const { origin, pathname } = window.location;
  const path = pathname === '/' ? '' : pathname.replace(/\/$/, '');
  return origin + path;
}

// ─── UI 상태 전환 ───
let boardVisible = false;

function resetEmailForm() {
  const el = id => document.getElementById(id);
  el('auth-email').value    = '';
  el('auth-password').value = '';
  el('auth-confirm').value  = '';
  el('auth-confirm').hidden     = true;
  el('auth-error').hidden       = true;
  el('auth-message').hidden     = true;
  el('email-check-msg').hidden  = true;
  el('auth-password').autocomplete = 'current-password';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="signin"]').classList.add('active');
  const btn = el('btn-email-submit');
  btn.textContent = '로그인';
  btn.disabled    = false;
}

function showLogin() {
  boardVisible = false;
  document.getElementById('login-overlay').hidden = false;
  document.querySelector('.kanban-board').hidden  = true;
  document.getElementById('header-user').hidden   = true;
  if (typeof window.resetBoard === 'function') window.resetBoard();
  resetEmailForm();
}

function showBoard(user) {
  if (boardVisible) return;
  boardVisible = true;
  document.getElementById('login-overlay').hidden = true;
  document.querySelector('.kanban-board').hidden  = false;
  if (typeof window.initBoard === 'function') window.initBoard(user);
}

function updateHeaderUser(user) {
  const avatarUrl    = user.user_metadata?.avatar_url ?? '';
  const displayName  = user.email ?? user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? '';
  document.getElementById('user-avatar').src         = avatarUrl;
  document.getElementById('user-email').textContent  = displayName;
  document.getElementById('header-user').hidden      = false;
}

// ─── OAuth 에러 표시 ───
function showOAuthError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.hidden = false;
}

function clearOAuthError() {
  const el = document.getElementById('login-error');
  el.textContent = '';
  el.hidden = true;
}

// ─── OAuth 로그인 (팝업 → 실패 시 리다이렉트 fallback) ───
async function signInWithOAuthPopup(provider) {
  clearOAuthError();
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getRedirectTo(), skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    showOAuthError(`${provider} 로그인 실패: Supabase 대시보드에서 프로바이더를 활성화하세요.`);
    return;
  }
  const popup = window.open(data.url, `oauth-${provider}`, 'width=520,height=680,left=200,top=80');
  if (!popup) window.location.href = data.url;
}

// ─── 이메일 인증 에러 한국어 변환 ───
function translateAuthError(msg) {
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (msg.includes('already registered'))        return '이미 가입된 이메일입니다.';
  if (msg.includes('Password should'))           return '비밀번호는 6자 이상이어야 합니다.';
  if (msg.includes('Unable to validate'))        return '이메일 형식을 확인하세요.';
  if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit'))
    return '이메일 발송 횟수가 초과되었습니다. 잠시 후 다시 시도하세요.';
  return msg;
}

// ─── 이메일 인증 폼 초기화 ───
function initEmailAuth() {
  let authMode = 'signin';

  const emailEl   = document.getElementById('auth-email');
  const passEl    = document.getElementById('auth-password');
  const confirmEl = document.getElementById('auth-confirm');
  const errEl     = document.getElementById('auth-error');
  const msgEl     = document.getElementById('auth-message');
  const checkEl   = document.getElementById('email-check-msg');
  const submitBtn = document.getElementById('btn-email-submit');

  function showCheck(type, msg) {
    checkEl.textContent  = msg;
    checkEl.dataset.type = type;
    checkEl.hidden       = false;
  }
  function hideCheck() {
    checkEl.hidden       = true;
    checkEl.dataset.type = '';
  }

  // 회원가입 모드에서 이메일 blur 시 중복 확인
  async function checkEmailDuplicate() {
    if (authMode !== 'signup') return;
    const email = emailEl.value.trim();
    if (!email || !email.includes('@')) { hideCheck(); return; }

    showCheck('checking', '이메일 확인 중…');
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: `__chk_${Date.now()}__`,
    });
    if (authMode !== 'signup') { hideCheck(); return; }
    if (error?.message?.includes('Email not confirmed') ||
        error?.message?.includes('already registered')) {
      showCheck('taken', '이미 가입된 이메일입니다');
    } else {
      hideCheck();
    }
  }

  emailEl.addEventListener('blur',  checkEmailDuplicate);
  emailEl.addEventListener('input', hideCheck);

  function setMode(mode) {
    authMode = mode;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${mode}"]`).classList.add('active');
    submitBtn.textContent     = mode === 'signin' ? '로그인' : '회원가입';
    const isSignup            = mode === 'signup';
    confirmEl.hidden          = !isSignup;
    passEl.autocomplete       = isSignup ? 'new-password' : 'current-password';
    errEl.hidden              = true;
    msgEl.hidden              = true;
    confirmEl.value           = '';
    hideCheck();
  }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.tab));
  });

  async function handleSubmit() {
    const email    = emailEl.value.trim();
    const password = passEl.value;
    errEl.hidden = true;
    msgEl.hidden = true;

    if (!email || !password) {
      errEl.textContent = '이메일과 비밀번호를 입력하세요.';
      errEl.hidden = false;
      return;
    }

    if (authMode === 'signup') {
      if (checkEl.dataset.type === 'taken') {
        errEl.textContent = '이미 가입된 이메일입니다.';
        errEl.hidden = false;
        emailEl.focus();
        return;
      }
      const confirm = confirmEl.value;
      if (!confirm) {
        errEl.textContent = '비밀번호 확인을 입력하세요.';
        errEl.hidden = false;
        confirmEl.focus();
        return;
      }
      if (password !== confirm) {
        errEl.textContent = '비밀번호가 일치하지 않습니다.';
        errEl.hidden = false;
        confirmEl.focus();
        return;
      }
    }

    submitBtn.disabled = true;

    if (authMode === 'signin') {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        errEl.textContent = translateAuthError(error.message);
        errEl.hidden      = false;
        submitBtn.disabled = false;
      }
      // 성공 시 onAuthStateChange → showBoard() 자동 호출
    } else {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        errEl.textContent  = translateAuthError(error.message);
        errEl.hidden       = false;
        submitBtn.disabled = false;
      } else if (data.user?.identities?.length === 0) {
        // 이메일 확인 ON 상태에서 기존 이메일 → Supabase가 fake success 반환
        errEl.textContent  = '이미 가입된 이메일입니다.';
        errEl.hidden       = false;
        showCheck('taken', '이미 가입된 이메일입니다');
        submitBtn.disabled = false;
      } else {
        msgEl.textContent = '확인 이메일을 발송했습니다. 받은편지함을 확인하고 링크를 클릭한 후 로그인하세요.';
        msgEl.hidden      = false;
        // 재발송 rate limit 방지: 60초 대기
        let remaining = 60;
        submitBtn.textContent = `재발송 대기 (${remaining}초)`;
        const timer = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            submitBtn.textContent = `재발송 대기 (${remaining}초)`;
          } else {
            clearInterval(timer);
            submitBtn.textContent  = '회원가입';
            submitBtn.disabled     = false;
          }
        }, 1000);
      }
    }
  }

  submitBtn.addEventListener('click', handleSubmit);
  emailEl.addEventListener('keydown',   e => { if (e.key === 'Enter') passEl.focus(); });
  passEl.addEventListener('keydown',    e => {
    if (e.key === 'Enter') authMode === 'signup' ? confirmEl.focus() : handleSubmit();
  });
  confirmEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(); });
}

// ─── 로그아웃 ───
async function signOut() {
  await supabaseClient.auth.signOut();
}

// ─── 초기화 ───
document.addEventListener('DOMContentLoaded', () => {

  // OAuth 팝업 창인 경우: 세션 확인 후 부모 창에 알리고 닫기
  if (window.opener && !window.opener.closed) {
    let handled = false;
    function closePopupWithSession(session) {
      if (handled) return;
      handled = true;
      if (session && !window.opener.closed) {
        window.opener.postMessage({ type: 'oauth-complete' }, window.location.origin);
      }
      window.close();
    }
    supabaseClient.auth.onAuthStateChange((_event, session) => closePopupWithSession(session));
    supabaseClient.auth.getSession().then(({ data: { session } }) => closePopupWithSession(session));
    return;
  }

  initEmailAuth();

  document.getElementById('btn-google').addEventListener('click', () => signInWithOAuthPopup('google'));
  document.getElementById('btn-github').addEventListener('click', () => signInWithOAuthPopup('github'));
  document.getElementById('btn-signout').addEventListener('click', signOut);

  // OAuth 팝업 완료 수신 → 세션 갱신 후 보드 표시
  window.addEventListener('message', async (e) => {
    if (e.origin !== window.location.origin || e.data?.type !== 'oauth-complete') return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      updateHeaderUser(session.user);
      showBoard(session.user);
    }
  });

  // 세션 변경 처리 (로그아웃, 다른 탭 로그인 등)
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      updateHeaderUser(session.user);
      showBoard(session.user);
    } else {
      showLogin();
    }
  });

  // 새로고침 시 기존 세션 즉시 복원
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      updateHeaderUser(session.user);
      showBoard(session.user);
    } else {
      showLogin();
    }
  });
});
