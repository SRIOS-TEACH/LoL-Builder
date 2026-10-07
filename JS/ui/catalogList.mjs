import {createLifecycle} from './lifecycle.mjs';
/** A catalog list owns selection visuals; queries and page navigation are callbacks. */
export function createCatalogList({root, kind, onInspect = () => {}, onSelect = () => {}}) {
  const life = createLifecycle();
  const attribute = kind === 'champion' ? 'data-champ' : 'data-item-id';
  let selected = null;
  const item = event => event.target.closest('[' + attribute + ']');
  life.on(root, 'click', event => { const button = item(event); if (button && root.contains(button)) onSelect(button.getAttribute(attribute)); });
  for (const type of ['mouseover', 'focusin']) life.on(root, type, event => {
    const button = item(event);
    if (button && root.contains(button) && selected !== button.getAttribute(attribute)) {
      selected = button.getAttribute(attribute); onInspect(selected);
    }
  });
  function select(id) {
    if (life.disposed) return;
    selected = id;
    root.querySelectorAll('[' + attribute + ']').forEach(button => button.classList.toggle('item-button-selected', kind === 'item' && button.getAttribute(attribute) === id));
  }
  function update({ids, records, version}) {
    if (life.disposed) return;
    root.replaceChildren(...ids.map(id => {
      const record = records[id], button = root.ownerDocument.createElement('button');
      button.className = 'item-button-icon'; button.setAttribute(attribute, id); button.title = kind === 'champion' ? id : record.name;
      const image = root.ownerDocument.createElement('img'); image.className = 'item-icon'; image.loading = 'lazy'; image.decoding = 'async';
      image.src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/${kind === 'champion' ? 'champion/' + record.image.full : 'item/' + id + '.png'}`;
      image.alt = kind === 'champion' ? id : record.name; button.append(image);
      if (kind === 'champion') { const label = root.ownerDocument.createElement('span'); label.className = 'picker-champ-name'; label.textContent = record.name; button.append(label); }
      return button;
    }));
    select(selected);
  }
  return {update, select, dispose:life.dispose};
}
