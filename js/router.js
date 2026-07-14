const routes = [];
let currentCleanup = null;
let notFoundHandler = null;

export function registerRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function setNotFoundHandler(handler) {
  notFoundHandler = handler;
}

function parseHash(hash) {
  const withoutPrefix = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, queryString] = withoutPrefix.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString || ''));
  return { path: `#${path}`, query };
}

function matchRoute(path) {
  for (const r of routes) {
    const match = r.pattern.exec(path);
    if (match) return { handler: r.handler, params: match.groups || {} };
  }
  return null;
}

export function navigate(path) {
  if (location.hash === path) {
    // 동일 경로 재진입 시에도 강제로 다시 렌더링한다.
    handleRoute();
  } else {
    location.hash = path;
  }
}

export function getCurrentPath() {
  return parseHash(location.hash || '#/dashboard').path;
}

async function handleRoute() {
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error(e);
    }
    currentCleanup = null;
  }

  const hash = location.hash || '#/dashboard';
  const { path, query } = parseHash(hash);
  const match = matchRoute(path);

  if (match) {
    const result = await match.handler({ ...match.params, query });
    if (typeof result === 'function') currentCleanup = result;
  } else if (notFoundHandler) {
    await notFoundHandler();
  }
}

export async function startRouter(defaultPath = '#/dashboard') {
  window.addEventListener('hashchange', handleRoute);
  if (!location.hash) {
    location.hash = defaultPath;
  } else {
    await handleRoute();
  }
}
