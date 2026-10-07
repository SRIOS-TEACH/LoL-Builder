let nextInstance=0;
export function createIdPrefix(){return 'control-'+(++nextInstance);}
/** Own listeners and DOM references for one component instance. */
export function createLifecycle() {
  let disposed = false;
  const cleanups = [];
  const properties = new Map();
  const on = (node, type, listener, options) => {
    if (disposed) return;
    const guarded = event => { if (!disposed) listener(event); };
    node.addEventListener(type, guarded, options);
    cleanups.push(() => node.removeEventListener(type, guarded, options));
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cleanups.splice(0).reverse().forEach(clean => clean());
    for (const [node, names] of properties) for (const name of names) node[name] = null;
    properties.clear();
  };
  const property = (node, name, listener) => {
    if (disposed) return;
    if (!properties.has(node)) properties.set(node, new Set());
    properties.get(node).add(name);
    node[name] = event => { if (!disposed) return listener(event); };
  };
  return {on, property, dispose, get disposed() { return disposed; }};
}

/** Named element slots supplied by the page; never searches the global document. */
export function createView(elements, idPrefix = '') {
  const nodes = [...new Set(Object.values(elements).filter(node => node?.nodeType === 1))];
  const roots = nodes.filter(node => !nodes.some(parent => parent !== node && parent.contains(node)));
  const owner = nodes[0]?.ownerDocument;
  const id = name => idPrefix ? idPrefix + '-' + name : name;
  const querySelector = selector => {
    for (const root of roots) {
      if (root.matches(selector)) return root;
      const match = root.querySelector(selector);
      if (match) return match;
    }
    return null;
  };
  return {
    getElementById: name => elements[name] || querySelector('#' + owner.defaultView.CSS.escape(id(name))),
    id,
    querySelector,
    querySelectorAll: selector => roots.flatMap(root => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)]),
    createElement: tag => owner.createElement(tag),
    get activeElement() { return owner.activeElement; },
  };
}
