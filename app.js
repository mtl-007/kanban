(() => {
  // ─── 모듈 상태 ───
  let draggedCard     = null;
  let draggedCardId   = null;
  let draggedCardTitle = null;
  let draggedOldColumn = null;

  let boardContext = { ownerId: null, ownerEmail: null, isOwner: true };
  let currentUser  = null;
  let activityPanelOpen = false;
  let pendingInviteId   = null;

  // ─── DOM 유틸 ───

  function updateCardCounts() {
    document.querySelectorAll('.column').forEach(column => {
      const count = column.querySelectorAll('.card').length;
      column.querySelector('.card-count').textContent = count;
    });
  }

  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    el.draggable = true;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-delete';
    deleteBtn.setAttribute('aria-label', '삭제');
    deleteBtn.textContent = '×';

    const titleEl = document.createElement('p');
    titleEl.className = 'card-title';
    titleEl.textContent = card.title;

    el.appendChild(deleteBtn);
    el.appendChild(titleEl);

    if (card.description) {
      const descEl = document.createElement('p');
      descEl.className = 'card-desc';
      descEl.textContent = card.description;
      el.appendChild(descEl);
    }

    return el;
  }

  // ─── Supabase CRUD ───

  async function getMaxPosition(columnName) {
    const { data } = await supabaseClient
      .from('cards')
      .select('position')
      .eq('user_id', boardContext.ownerId)
      .eq('column_name', columnName)
      .order('position', { ascending: false })
      .limit(1);
    return data && data.length > 0 ? data[0].position : -1;
  }

  async function loadCards() {
    document.querySelectorAll('.card-list').forEach(list => {
      list.querySelectorAll('.card').forEach(c => c.remove());
    });

    const { data, error } = await supabaseClient
      .from('cards')
      .select('id, column_name, title, description, position')
      .eq('user_id', boardContext.ownerId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('카드 로드 실패:', error.message);
      return;
    }

    (data || []).forEach(card => {
      const list = document.getElementById(`${card.column_name}-list`);
      if (list) list.appendChild(createCardElement(card));
    });

    updateCardCounts();
    updateBoardContextLabel();
  }

  async function saveNewCard(title, columnName) {
    const maxPos = await getMaxPosition(columnName);

    const { data, error } = await supabaseClient
      .from('cards')
      .insert({ user_id: boardContext.ownerId, column_name: columnName, title, position: maxPos + 1 })
      .select()
      .single();

    if (error) {
      console.error('카드 저장 실패:', error.message);
      return null;
    }

    await logActivity({ event_type: 'card_added', card_title: title, to_column: columnName });
    return data;
  }

  async function removeCard(cardId, cardTitle, columnName) {
    const { error } = await supabaseClient.from('cards').delete().eq('id', cardId);
    if (error) {
      console.error('카드 삭제 실패:', error.message);
      return false;
    }
    await logActivity({ event_type: 'card_deleted', card_title: cardTitle, from_column: columnName });
    return true;
  }

  async function updateCardColumn(cardId, cardTitle, oldColumnName, newColumnName) {
    const maxPos = await getMaxPosition(newColumnName);
    const { error } = await supabaseClient
      .from('cards')
      .update({ column_name: newColumnName, position: maxPos + 1 })
      .eq('id', cardId);
    if (error) {
      console.error('카드 이동 실패:', error.message);
      return;
    }
    await logActivity({ event_type: 'card_moved', card_title: cardTitle, from_column: oldColumnName, to_column: newColumnName });
  }

  // ─── 활동 로그 ───

  async function logActivity({ event_type, card_title, from_column = null, to_column = null }) {
    const { error } = await supabaseClient.from('activity_logs').insert({
      board_owner_id: boardContext.ownerId,
      actor_id:       currentUser.id,
      actor_email:    currentUser.email,
      event_type,
      card_title,
      from_column,
      to_column,
    });
    if (error) console.warn('활동 로그 저장 실패:', error.message);
    if (activityPanelOpen) await loadActivityLogs();
  }

  function buildActivityDescription(log) {
    const colName = n => ({ todo: 'TO-DO', inprogress: 'In-Progress', done: 'Done' }[n] ?? n);
    const t = `"${log.card_title}"`;
    if (log.event_type === 'card_added')   return `님이 ${t} 카드를 <strong>${colName(log.to_column)}</strong>에 추가했습니다.`;
    if (log.event_type === 'card_deleted') return `님이 ${t} 카드를 삭제했습니다.`;
    if (log.event_type === 'card_moved')   return `님이 ${t}을(를) <strong>${colName(log.from_column)}</strong>에서 <strong>${colName(log.to_column)}</strong>으로 이동했습니다.`;
    return '';
  }

  function formatRelativeTime(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  async function loadActivityLogs() {
    const { data, error } = await supabaseClient
      .from('activity_logs')
      .select('event_type, card_title, actor_email, from_column, to_column, created_at')
      .eq('board_owner_id', boardContext.ownerId)
      .order('created_at', { ascending: false })
      .limit(50);

    const list = document.getElementById('activity-list');
    list.innerHTML = '';

    if (error || !data?.length) {
      const li = document.createElement('li');
      li.style.cssText = 'padding: 16px 20px; color: var(--color-text-muted); font-size: 0.85rem;';
      li.textContent = '활동 내역이 없습니다.';
      list.appendChild(li);
      return;
    }

    data.forEach(log => {
      const li = document.createElement('li');
      li.className = 'activity-item';
      const cls  = log.event_type === 'card_added' ? 'added' : log.event_type === 'card_deleted' ? 'deleted' : 'moved';
      const icon = log.event_type === 'card_added' ? '+' : log.event_type === 'card_deleted' ? '−' : '→';
      li.innerHTML = `
        <span class="activity-icon ${cls}">${icon}</span>
        <div class="activity-body">
          <span class="activity-actor">${log.actor_email}</span>${buildActivityDescription(log)}
          <time class="activity-time">${formatRelativeTime(log.created_at)}</time>
        </div>`;
      list.appendChild(li);
    });
  }

  function toggleActivityPanel() {
    activityPanelOpen = !activityPanelOpen;
    const panel   = document.getElementById('activity-panel');
    const wrapper = document.getElementById('board-wrapper');
    const btn     = document.getElementById('btn-activity');
    panel.hidden = !activityPanelOpen;
    wrapper.classList.toggle('panel-open', activityPanelOpen);
    btn.classList.toggle('active', activityPanelOpen);
    if (activityPanelOpen) loadActivityLogs();
  }

  document.getElementById('btn-activity').addEventListener('click', toggleActivityPanel);
  document.getElementById('activity-panel-close').addEventListener('click', () => {
    activityPanelOpen = false;
    document.getElementById('activity-panel').hidden = true;
    document.getElementById('board-wrapper').classList.remove('panel-open');
    document.getElementById('btn-activity').classList.remove('active');
  });

  // ─── 보드 컨텍스트 ───

  function updateBoardContextLabel() {
    const label = document.getElementById('board-context-label');
    if (boardContext.isOwner) {
      label.hidden = true;
    } else {
      label.textContent = `${boardContext.ownerEmail}의 보드`;
      label.hidden = false;
    }
  }

  async function loadBoardSelector() {
    const sel = document.getElementById('board-selector');
    while (sel.options.length > 1) sel.remove(1);

    const { data, error } = await supabaseClient
      .from('board_shares')
      .select('owner_id, owner_email')
      .eq('member_id', currentUser.id)
      .eq('status', 'accepted');

    if (error || !data?.length) return;

    data.forEach(row => {
      const opt = document.createElement('option');
      opt.value = row.owner_id;
      opt.textContent = `${row.owner_email}의 보드`;
      sel.appendChild(opt);
    });
  }

  document.getElementById('board-selector').addEventListener('change', async e => {
    const val = e.target.value;
    if (val === 'own') {
      boardContext = { ownerId: currentUser.id, ownerEmail: currentUser.email, isOwner: true };
    } else {
      const opt = e.target.selectedOptions[0];
      boardContext = { ownerId: val, ownerEmail: opt.textContent.replace('의 보드', ''), isOwner: false };
    }
    await loadCards();
    if (activityPanelOpen) await loadActivityLogs();
  });

  // ─── 공유 모달 ───

  function openShareModal() {
    document.getElementById('share-modal').hidden = false;
    loadShareMembers();
  }

  function closeShareModal() {
    document.getElementById('share-modal').hidden = true;
    const msg = document.getElementById('share-invite-msg');
    msg.hidden = true;
    document.getElementById('share-email-input').value = '';
  }

  document.getElementById('btn-share').addEventListener('click', openShareModal);
  document.getElementById('share-modal-close').addEventListener('click', closeShareModal);
  document.getElementById('share-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeShareModal();
  });

  async function loadShareMembers() {
    const list = document.getElementById('share-member-list');
    list.innerHTML = '';

    const { data, error } = await supabaseClient
      .from('board_shares')
      .select('id, member_email, status')
      .eq('owner_id', currentUser.id)
      .order('invited_at', { ascending: true });

    if (error || !data?.length) {
      const li = document.createElement('li');
      li.style.cssText = 'color: var(--color-text-muted); font-size: 0.85rem; padding: 8px 0;';
      li.textContent = '공유된 멤버가 없습니다.';
      list.appendChild(li);
      return;
    }

    data.forEach(row => {
      const li = document.createElement('li');
      li.className = 'share-member-item';
      li.innerHTML = `
        <span class="share-member-email">${row.member_email}</span>
        <span class="share-member-status ${row.status}">${row.status === 'pending' ? '대기 중' : '수락됨'}</span>
        <button class="btn-member-remove" aria-label="제거">×</button>`;
      li.querySelector('.btn-member-remove').addEventListener('click', () => removeMember(row.id));
      list.appendChild(li);
    });
  }

  function showInviteMsg(text, type) {
    const el = document.getElementById('share-invite-msg');
    el.textContent = text;
    el.className = `share-invite-msg ${type}`;
    el.hidden = false;
  }

  async function sendInvite() {
    const emailInput = document.getElementById('share-email-input');
    const btn        = document.getElementById('btn-invite-send');
    const email      = emailInput.value.trim().toLowerCase();

    document.getElementById('share-invite-msg').hidden = true;

    if (!email || !email.includes('@')) { showInviteMsg('이메일 형식을 확인하세요.', 'error'); return; }
    if (email === currentUser.email)    { showInviteMsg('본인은 초대할 수 없습니다.', 'error'); return; }

    btn.disabled    = true;
    btn.textContent = '초대 중...';

    const { data: targetId, error: rpcErr } = await supabaseClient
      .rpc('get_user_id_by_email', { p_email: email });

    if (rpcErr || !targetId) {
      showInviteMsg('가입된 사용자를 찾을 수 없습니다.', 'error');
      btn.disabled = false; btn.textContent = '초대';
      return;
    }

    const { error } = await supabaseClient.from('board_shares').insert({
      owner_id:     currentUser.id,
      owner_email:  currentUser.email,
      member_id:    targetId,
      member_email: email,
    });

    btn.disabled = false;
    btn.textContent = '초대';

    if (error) {
      const msg = error.code === '23505' ? '이미 초대한 사용자입니다.' : '초대 전송에 실패했습니다.';
      showInviteMsg(msg, 'error');
    } else {
      showInviteMsg('초대를 전송했습니다.', 'success');
      emailInput.value = '';
      loadShareMembers();
    }
  }

  async function removeMember(shareId) {
    const { error } = await supabaseClient.from('board_shares').delete().eq('id', shareId);
    if (!error) loadShareMembers();
  }

  document.getElementById('btn-invite-send').addEventListener('click', sendInvite);

  // ─── 초대 알림 배너 ───

  async function checkPendingInvites() {
    const { data, error } = await supabaseClient
      .from('board_shares')
      .select('id, owner_email')
      .eq('member_id', currentUser.id)
      .eq('status', 'pending')
      .order('invited_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    pendingInviteId = data.id;
    document.getElementById('invite-banner-msg').textContent =
      `${data.owner_email}님이 보드에 초대했습니다.`;
    document.getElementById('invite-banner').hidden = false;
  }

  document.getElementById('btn-invite-accept').addEventListener('click', async () => {
    if (!pendingInviteId) return;
    const { error } = await supabaseClient
      .from('board_shares')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', pendingInviteId);

    document.getElementById('invite-banner').hidden = true;
    pendingInviteId = null;
    if (!error) await loadBoardSelector();
  });

  document.getElementById('btn-invite-decline').addEventListener('click', async () => {
    if (!pendingInviteId) return;
    await supabaseClient.from('board_shares').delete().eq('id', pendingInviteId);
    document.getElementById('invite-banner').hidden = true;
    pendingInviteId = null;
  });

  // ─── 드래그 이벤트 ───

  document.querySelector('.kanban-board').addEventListener('dragstart', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    draggedCard      = card;
    draggedCardId    = card.dataset.cardId;
    draggedCardTitle = card.querySelector('.card-title').textContent;
    draggedOldColumn = card.closest('.column').dataset.column;
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCardId);
  });

  document.querySelector('.kanban-board').addEventListener('dragend', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    card.classList.remove('dragging');
    draggedCard      = null;
    draggedCardId    = null;
    draggedCardTitle = null;
    draggedOldColumn = null;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
  });

  document.querySelectorAll('.card-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.closest('.column').classList.add('drag-over');
    });

    list.addEventListener('dragleave', e => {
      if (!list.contains(e.relatedTarget)) {
        list.closest('.column').classList.remove('drag-over');
      }
    });

    list.addEventListener('drop', e => {
      e.preventDefault();
      const column = list.closest('.column');
      column.classList.remove('drag-over');
      if (draggedCard && draggedCard.closest('.card-list') !== list) {
        const newColumnName = column.dataset.column;
        list.appendChild(draggedCard);
        updateCardCounts();
        updateCardColumn(draggedCardId, draggedCardTitle, draggedOldColumn, newColumnName);
      }
    });
  });

  // ─── 카드 추가 ───

  document.querySelectorAll('.add-card-area').forEach(area => {
    const form       = area.querySelector('.add-card-form');
    const input      = area.querySelector('.add-card-input');
    const btnAdd     = area.querySelector('.btn-add-card');
    const btnCancel  = area.querySelector('.btn-cancel');
    const btnConfirm = area.querySelector('.btn-confirm');
    const cardList   = area.closest('.column').querySelector('.card-list');
    const columnName = area.closest('.column').dataset.column;

    btnAdd.addEventListener('click', () => {
      form.hidden = false;
      btnAdd.hidden = true;
      input.focus();
    });

    btnCancel.addEventListener('click', () => {
      form.hidden = true;
      btnAdd.hidden = false;
      input.value = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;

      btnConfirm.disabled    = true;
      btnConfirm.textContent = '저장 중...';

      const card = await saveNewCard(title, columnName);

      btnConfirm.disabled    = false;
      btnConfirm.textContent = '추가';

      if (!card) return;

      cardList.appendChild(createCardElement(card));
      input.value   = '';
      form.hidden   = true;
      btnAdd.hidden = false;
      updateCardCounts();
    });
  });

  // ─── 카드 삭제 (이벤트 위임) ───

  document.querySelector('.kanban-board').addEventListener('click', async e => {
    if (!e.target.classList.contains('card-delete')) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const cardId     = card.dataset.cardId;
    const cardTitle  = card.querySelector('.card-title').textContent;
    const columnName = card.closest('.column').dataset.column;
    const ok = await removeCard(cardId, cardTitle, columnName);
    if (ok) {
      card.remove();
      updateCardCounts();
    }
  });

  // ─── 초기화 ───

  async function initBoardWithUser(user) {
    currentUser  = user;
    boardContext = { ownerId: user.id, ownerEmail: user.email, isOwner: true };

    const sel = document.getElementById('board-selector');
    sel.value = 'own';

    await loadBoardSelector();
    await loadCards();
    await checkPendingInvites();
  }

  window.initBoard = initBoardWithUser;

  window.resetBoard = function () {
    activityPanelOpen = false;
    pendingInviteId   = null;
    currentUser       = null;
    boardContext      = { ownerId: null, ownerEmail: null, isOwner: true };

    document.getElementById('invite-banner').hidden    = true;
    document.getElementById('activity-panel').hidden   = true;
    document.getElementById('board-wrapper').classList.remove('panel-open');
    document.getElementById('btn-activity').classList.remove('active');

    const sel = document.getElementById('board-selector');
    while (sel.options.length > 1) sel.remove(1);
    sel.value = 'own';
  };
})();
