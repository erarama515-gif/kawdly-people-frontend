import { useEffect, useState } from 'react';

/** True after the first animation frame, for CSS-transition "settle" reveals. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return mounted;
}