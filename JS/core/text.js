
/** Reusable capability; no page initialization or DOM dependency. */

function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}


function searchText(value) { return String(value || "").trim().toLowerCase(); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const api = {stripHtml, searchText, escapeHtml};
const exportedApi = api;

export default exportedApi;
