import {createLifecycle} from './lifecycle.mjs';
/** One detail view owns only its current request; source loading is injected. */
export function createChampionDetail({root, loadDetail}) {
  const life = createLifecycle(); let request = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function update({id, record, version}) {
    if (life.disposed) return;
    const ticket = ++request;
    if (!id) { root.innerHTML = "<p class='text-muted'>No champion found.</p>"; return; }
    const header = `<h3>${escape(id)}</h3><img class='item-detail-icon' src='https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${escape(record.image.full)}' alt='${escape(id)}'><p><strong>Tags:</strong> ${escape((record.tags || []).join(', '))}</p><p>${escape(record.blurb)}</p>`;
    root.innerHTML = header + "<div class='champ-ability-strip'><span class='text-muted'>Loading abilities...</span></div>";
    const detail = await loadDetail(id).catch(() => null);
    if (life.disposed || ticket !== request) return;
    const icons = (detail?.spells || []).map(spell => `<img class='champ-ability-icon' src='https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${escape(spell.image.full)}' title='${escape(spell.name)}' alt='${escape(spell.name)}' loading='lazy'>`).join('');
    root.innerHTML = header + `<div class='champ-ability-strip'>${icons || "<span class='text-muted'>No abilities found.</span>"}</div>`;
  }
  return {update, dispose() { request++; life.dispose(); }};
}
