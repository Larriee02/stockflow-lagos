import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const RouterContext = createContext({
  path: '/login',
  navigate: () => {},
});

export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => {
    if (typeof window === 'undefined') return '/login';
    return window.location.pathname || '/login';
  });

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname || '/login');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath, { replace = false } = {}) => {
    if (typeof window === 'undefined') return;
    const cleanPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    if (window.location.pathname !== cleanPath) {
      if (replace) {
        window.history.replaceState({}, '', cleanPath);
      } else {
        window.history.pushState({}, '', cleanPath);
      }
    }
    setPath(cleanPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}
