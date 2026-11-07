// Where downloaded models are kept. Both stores share one async interface:
//   get(key) -> ArrayBuffer | null, put(key, ArrayBuffer | string), delete(key), getText(key) -> string | null

export const memoryStorage = () => {
  const items = new Map();
  const toBuffer = (data) => (typeof data === 'string' ? new TextEncoder().encode(data).buffer : data.slice(0));
  return {
    get: async (key) => (items.has(key) ? items.get(key).slice(0) : null),
    getText: async (key) => (items.has(key) ? new TextDecoder().decode(items.get(key)) : null),
    put: async (key, data) => {
      items.set(key, toBuffer(data));
    },
    delete: async (key) => {
      items.delete(key);
    },
  };
};

// The browser's Cache Storage: kept across visits, cleared with the site's data. Falls back to memory
// where it isn't available (older browsers, some private modes, tests).
export const cacheStorage = (name) => {
  if (typeof caches === 'undefined') return memoryStorage();
  const url = (key) => `https://models.healthnet.invalid/${encodeURIComponent(key)}`;
  const open = () => caches.open(name);
  return {
    get: async (key) => {
      const response = await (await open()).match(url(key));
      return response ? response.arrayBuffer() : null;
    },
    getText: async (key) => {
      const response = await (await open()).match(url(key));
      return response ? response.text() : null;
    },
    put: async (key, data) => {
      await (await open()).put(url(key), new Response(data));
    },
    delete: async (key) => {
      await (await open()).delete(url(key));
    },
  };
};
