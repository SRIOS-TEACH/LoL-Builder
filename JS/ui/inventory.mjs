import {createLifecycle,createIdPrefix} from './lifecycle.mjs';
export function createInventory({root, cost, onSelect, idPrefix = createIdPrefix()}) {
  const life = createLifecycle();
  life.on(root, 'click', event => { const button = event.target.closest('[data-slot]'); if (button && root.contains(button)) onSelect(Number(button.dataset.slot)); });
  function update({slots, items, version}) {
    if (life.disposed) return;
    root.replaceChildren(...slots.map((id, index) => {
      const button = root.ownerDocument.createElement('button');
      button.className = `item-slot-btn ${index === 6 ? 'role-quest-slot' : index === 7 ? 'bot-boots-slot' : ''}`;
      button.dataset.slot = index; button.setAttribute('aria-label', index === 6 ? 'Role quest' : index === 7 ? 'Bot quest boots' : 'Item slot ' + (index + 1));
      button.title = index === 6 ? 'Role quest item' : 'Item slot ' + (index + 1);
      const content = root.ownerDocument.createElement('div');content.id=(idPrefix?idPrefix+'-':'')+'slotText'+index;
      if (!id) { content.className = 'item-slot-empty'; content.textContent = '+'; }
      else { const image = root.ownerDocument.createElement('img'); image.className = 'item-slot-icon'; image.src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`; image.alt = image.title = items[id].name; content.append(image); }
      button.append(content); return button;
    }));
    const gold = slots.reduce((total, id, index) => index === 6 || !id ? total : total + (Number(items[id]?.gold?.total) || 0), 0).toLocaleString('en-US');
    cost.textContent = gold; cost.parentElement.setAttribute('aria-label', `Total build cost: ${gold} gold`);
  }
  return {update, dispose:life.dispose};
}
