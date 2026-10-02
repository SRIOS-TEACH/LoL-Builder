/** Reusable capability; no page initialization or DOM dependency. */
(function(scope){
function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}


function searchText(value) { return String(value || "").trim().toLowerCase(); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const api = {stripHtml, searchText, escapeHtml};
scope.TextValues = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
