(() => {
  let draggedCard = null;
  let draggedCardId = null;

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
  }

  async function saveNewCard(title, columnName) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const maxPos = await getMaxPosition(columnName);

    const { data, error } = await supabaseClient
      .from('cards')
      .insert({ user_id: user.id, column_name: columnName, title, position: maxPos + 1 })
      .select()
      .single();

    if (error) {
      console.error('카드 저장 실패:', error.message);
      return null;
    }
    return data;
  }

  async function removeCard(cardId) {
    const { error } = await supabaseClient.from('cards').delete().eq('id', cardId);
    if (error) {
      console.error('카드 삭제 실패:', error.message);
      return false;
    }
    return true;
  }

  async function updateCardColumn(cardId, newColumnName) {
    const maxPos = await getMaxPosition(newColumnName);
    const { error } = await supabaseClient
      .from('cards')
      .update({ column_name: newColumnName, position: maxPos + 1 })
      .eq('id', cardId);
    if (error) console.error('카드 이동 실패:', error.message);
  }

  // ─── 드래그 이벤트 ───

  document.querySelector('.kanban-board').addEventListener('dragstart', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    draggedCard = card;
    draggedCardId = card.dataset.cardId;
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCardId);
  });

  document.querySelector('.kanban-board').addEventListener('dragend', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    card.classList.remove('dragging');
    draggedCard = null;
    draggedCardId = null;
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
        updateCardColumn(draggedCardId, newColumnName);
      }
    });
  });

  // ─── 카드 추가 ───

  document.querySelectorAll('.add-card-area').forEach(area => {
    const form = area.querySelector('.add-card-form');
    const input = area.querySelector('.add-card-input');
    const btnAdd = area.querySelector('.btn-add-card');
    const btnCancel = area.querySelector('.btn-cancel');
    const btnConfirm = area.querySelector('.btn-confirm');
    const cardList = area.closest('.column').querySelector('.card-list');
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

      btnConfirm.disabled = true;
      btnConfirm.textContent = '저장 중...';

      const card = await saveNewCard(title, columnName);

      btnConfirm.disabled = false;
      btnConfirm.textContent = '추가';

      if (!card) return;

      cardList.appendChild(createCardElement(card));
      input.value = '';
      form.hidden = true;
      btnAdd.hidden = false;
      updateCardCounts();
    });
  });

  // ─── 카드 삭제 (이벤트 위임) ───

  document.querySelector('.kanban-board').addEventListener('click', async e => {
    if (!e.target.classList.contains('card-delete')) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const cardId = card.dataset.cardId;
    const ok = await removeCard(cardId);
    if (ok) {
      card.remove();
      updateCardCounts();
    }
  });

  // ─── auth.js showBoard()에서 호출 ───
  window.initBoard = loadCards;
})();
