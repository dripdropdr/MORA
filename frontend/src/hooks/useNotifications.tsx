import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info' | 'warning';
type Notice = { id: number; kind: Kind; message: string; ttl?: number };

const Ctx = createContext<{ push: (kind: Kind, message: string, ttl?: number) => void; items: Notice[]; remove: (id: number) => void; } | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notice[]>([]);
  const remove = useCallback((id: number) => setItems((s) => s.filter((n) => n.id !== id)), []);
  const push = useCallback((kind: Kind, message: string, ttl = 4000) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, message, ttl }]);
    if (ttl > 0) setTimeout(() => remove(id), ttl);
  }, [remove]);
  return <Ctx.Provider value={{ push, items, remove }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error('NotificationsProvider missing');
  return c;
}
