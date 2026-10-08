
  const key='lol-buildsmith.builds.v1';
  function read(){const raw=localStorage.getItem(key);if(!raw)return [];const records=JSON.parse(raw);if(!Array.isArray(records))throw new Error('Saved build data is invalid');return records.filter(b=>b && b.schema===1 && typeof b.id==='string' && b.state && typeof b.name==='string');}
  function write(records){localStorage.setItem(key,JSON.stringify(records));}
  function save(build){const records=read();const index=records.findIndex(b=>b.id===build.id);if(index<0)records.push(build);else records[index]=build;write(records);return build;}
  const SavedBuilds={read,save,remove(id){write(read().filter(b=>b.id!==id));},copy(id){const source=read().find(b=>b.id===id);if(!source)throw new Error('Build no longer exists');return save({...source,id:crypto.randomUUID(),name:source.name+' (copy)',savedAt:new Date().toISOString()});}};
export default SavedBuilds;
