import TextValues from '../core/text.js';
/** Reusable capability; no page initialization or DOM dependency. */

const text=TextValues;
const RUNE_PATH_ID_TO_KEY = {
  8100: "domination",
  8000: "precision",
  8200: "sorcery",
  8300: "inspiration",
  8400: "resolve",
  // Legacy fallback ids kept for compatibility with older/static payloads.
  7200: "domination",
  7201: "precision",
  7202: "sorcery",
  7203: "inspiration",
  7204: "resolve",
};

function slugifyRuneName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDdragonPerkIcon(version, iconPath) {
  if (!iconPath) return "";
  return `https://ddragon.leagueoflegends.com/cdn/img/${String(iconPath).replace(/^\/+/, "")}`;
}

function buildPathDefaults(paths) {
  return Object.fromEntries(
    Object.entries(paths).map(([id, path]) => [
      id,
      (path.primaryRows || []).map((row) => row[0]).filter(Boolean).slice(0, 4),
    ]),
  );
}


function normalizeRunes(runes, paths = {}, lookup = {}) {
 const nextPaths={...paths}, nextLookup={...lookup};
 (runes || []).forEach(path => {
  const key=RUNE_PATH_ID_TO_KEY[path.id]; if(!key)return;
  const icon=toDdragonPerkIcon('',path.icon);
  const primaryRows=(path.slots || []).map(slot=>(slot.runes || []).map(rune=>{
   const slug=slugifyRuneName(rune.name);
   nextLookup[slug]={name:rune.name,desc:text.stripHtml(rune.longDesc || rune.shortDesc || ""),icon:toDdragonPerkIcon('',rune.icon)};
   return slug;
  }));
  nextPaths[key]={...nextPaths[key],name:path.name,icon:icon || nextPaths[key]?.icon || "",splash:'url('+(icon || nextPaths[key]?.icon || "")+')',primaryRows:primaryRows.length?primaryRows:(nextPaths[key]?.primaryRows || [])};
 });
 return {paths:nextPaths,runeLookup:nextLookup,pathDefaults:buildPathDefaults(nextPaths)};
}

const api = {slugifyRuneName, toDdragonPerkIcon, buildPathDefaults, normalizeRunes};
const exportedApi = api;

export default exportedApi;
