import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth.ts'
import { getCurrentUserId, setUserData } from '../utils/storage.ts';
import styles from '../styles/Login.module.css';

export function Login() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    const currentUser = getCurrentUserId();
    if (currentUser) {
      navigate('/start');
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      setError('Please enter your ID.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await login(trimmedUserId);

      if (data.success) {
        // localStorage에 저장
        setUserData({
          userId: trimmedUserId,
          loginTime: new Date().toISOString(),
          stories: data.stories || {},
        });

        setSuccess('Login successful! Redirecting...');
        
        // 1초 후 리다이렉트
        setTimeout(() => {
          navigate('/start');
        }, 1000);
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 에러 메시지 자동 숨김
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <h1>🎭</h1>
        <h2>Interactive Story Intervention</h2>
        
        <form onSubmit={handleSubmit} id="login-form">
          <div className={styles.inputGroup}>
            <label htmlFor="user-id">User ID</label>
            <input
              type="text"
              id="user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your ID"
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            id="login-btn"
            disabled={loading}
            className={styles.loginBtn}
          >
            {loading ? (
              <>
                <span className={styles.loading}></span> Logging in...
              </>
            ) : (
              '🚪 Login'
            )}
          </button>
        </form>

        {error && (
          <div className={`${styles.errorMessage} ${styles.show}`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`${styles.successMessage} ${styles.show}`}>
            {success}
          </div>
        )}

        <div className={styles.helpText}>
          <p>Please enter your registered user ID to continue.</p>
        </div>
      </div>
    </div>
  );
}