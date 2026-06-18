(() => {
  let draggedCard = null;
  let cardIdCounter = 100;

  function updateCardCounts() {
    document.querySelectorAll('.column').forEach(column => {
      const count = column.querySelectorAll('.card').length;
      column.querySelector('.card-count').textContent = count;
    });
  }

  function createCard(title, desc = '') {
    cardIdCounter++;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${cardIdCounter}`;
    card.draggable = true;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-delete';
    deleteBtn.setAttribute('aria-label', '삭제');
    deleteBtn.textContent = '×';

    const titleEl = document.createElement('p');
    titleEl.className = 'card-title';
    titleEl.textContent = title;

    card.appendChild(deleteBtn);
    card.appendChild(titleEl);

    if (desc) {
      const descEl = document.createElement('p');
      descEl.className = 'card-desc';
      descEl.textContent = desc;
      card.appendChild(descEl);
    }

    return card;
  }

  // ─── 드래그 이벤트 (이벤트 위임) ───
  document.querySelector('.kanban-board').addEventListener('dragstart', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    draggedCard = card;
    // 다음 프레임에 dragging 클래스를 추가해야 드래그 이미지가 정상 표시됨
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
  });

  document.querySelector('.kanban-board').addEventListener('dragend', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    card.classList.remove('dragging');
    draggedCard = null;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
  });

  document.querySelectorAll('.card-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.closest('.column').classList.add('drag-over');
    });

    list.addEventListener('dragleave', e => {
      // 자식 요소로 이동할 때 발생하는 오발화 방지
      if (!list.contains(e.relatedTarget)) {
        list.closest('.column').classList.remove('drag-over');
      }
    });

    list.addEventListener('drop', e => {
      e.preventDefault();
      const column = list.closest('.column');
      column.classList.remove('drag-over');
      if (draggedCard && draggedCard.closest('.card-list') !== list) {
        list.appendChild(draggedCard);
        updateCardCounts();
      }
    });
  });

  // ─── 카드 추가 ───
  document.querySelectorAll('.add-card-area').forEach(area => {
    const form = area.querySelector('.add-card-form');
    const input = area.querySelector('.add-card-input');
    const btnAdd = area.querySelector('.btn-add-card');
    const btnCancel = area.querySelector('.btn-cancel');
    const cardList = area.closest('.column').querySelector('.card-list');

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

    form.addEventListener('submit', e => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      const card = createCard(title);
      cardList.appendChild(card);
      input.value = '';
      form.hidden = true;
      btnAdd.hidden = false;
      updateCardCounts();
    });
  });

  // ─── 카드 삭제 (이벤트 위임) ───
  document.querySelector('.kanban-board').addEventListener('click', e => {
    if (!e.target.classList.contains('card-delete')) return;
    const card = e.target.closest('.card');
    if (card) {
      card.remove();
      updateCardCounts();
    }
  });

  // 초기 카운트 반영
  updateCardCounts();
})();
