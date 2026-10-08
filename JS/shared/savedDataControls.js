/** User-facing management of Buildsmith's browser data. Never clear unrelated site storage. */
const keys = {builds:'lol-buildsmith.builds.v1', preferences:'lol-buildsmith.compare.v1'};
for (const host of document.querySelectorAll('[data-saved-data-controls]')) {
  host.innerHTML = `<details class="saved-data-settings"><summary>Saved data</summary><p>Your builds and comparison preferences are saved in this browser on this device.</p><div class="saved-data-actions"><button type="button" class="btn" data-clear-scope="builds">Delete all builds</button><button type="button" class="btn" data-clear-scope="all">Clear all saved data</button></div><p class="saved-data-status" role="status"></p></details>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'saved-data-dialog';
  const titleId = `saved-data-title-${document.querySelectorAll('.saved-data-dialog').length}`;
  dialog.setAttribute('aria-labelledby',titleId);
  dialog.innerHTML = `<h2 id="${titleId}"></h2><p class="saved-data-description"></p><p>This cannot be undone.</p><p class="saved-data-error" role="alert"></p><div class="saved-data-actions"><button type="button" class="btn" data-cancel-clear autofocus>Cancel</button><button type="button" class="btn saved-data-confirm" data-confirm-clear></button></div>`;
  document.body.append(dialog);
  let scope, trigger;
  const close = () => {dialog.close();trigger?.focus();};
  host.addEventListener('click',event => {
    const button = event.target.closest('[data-clear-scope]');
    if (!button) return;
    scope = button.dataset.clearScope;
    trigger = button;
    dialog.querySelector('h2').textContent = scope==='all' ? 'Clear all saved data?' : 'Delete all saved builds?';
    dialog.querySelector('.saved-data-description').textContent = scope==='all'
      ? 'This deletes every saved build and resets comparison sorting, card order, and pinned builds in this browser. Data on other devices or browsers is not affected.'
      : 'This deletes every saved build in this browser, including builds hidden by a search. Your comparison sorting preferences will be kept.';
    dialog.querySelector('[data-confirm-clear]').textContent = scope==='all' ? 'Clear saved data' : 'Delete builds';
    dialog.querySelector('.saved-data-error').textContent = '';
    dialog.showModal();
  });
  dialog.querySelector('[data-cancel-clear]').onclick = close;
  dialog.addEventListener('cancel',event => {event.preventDefault();close();});
  dialog.querySelector('[data-confirm-clear]').onclick = () => {
    try {
      localStorage.removeItem(keys.builds);
      if (scope==='all') localStorage.removeItem(keys.preferences);
      window.dispatchEvent(new CustomEvent('saved-data-cleared',{detail:{scope}}));
      host.querySelector('.saved-data-status').textContent = scope==='all' ? 'All saved builds and comparison preferences cleared.' : 'All saved builds deleted.';
      close();
    } catch {
      dialog.querySelector('.saved-data-error').textContent = 'Could not finish clearing saved data. Check that your browser allows site storage, then try again.';
    }
  };
}
