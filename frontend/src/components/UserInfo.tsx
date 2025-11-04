import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { getCurrentUserId, clearUserData } from '../utils/storage';
import styles from '../styles/UserInfo.module.css';

//mostly about logout information

export function UserInfo() {
  const navigate = useNavigate();
  const userId = getCurrentUserId();

  const handleLogout = async () => {
    try {
      if (userId) {
        await logout(userId);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearUserData();
      navigate('/login');
    }
  };

  if (!userId) return null;

  return (
    <div className={styles.userInfo}>
      <p>
        👤 Logged in as: <strong>{userId}</strong> |{' '}
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </p>
    </div>
  );
}