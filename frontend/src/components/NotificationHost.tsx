import { useNotifications } from '../hooks/useNotifications';

export function NotificationHost() {
  const { items, remove } = useNotifications();
  
  return (
    <div id="notification-container" className="notification-container">
      {items.map((n) => (
        <div 
          key={n.id} 
          className={`notification ${n.kind} show`} 
          onClick={() => remove(n.id)}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
