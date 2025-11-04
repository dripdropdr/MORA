import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
});

export interface LoginResponse {
  success: boolean;
  message: string;
  user_id?: string;
  user_name?: string;
  stories?: any;
}

export async function login(userId: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', {
    user_id: userId,
  });
  return data;
}

export async function logout(userId: string): Promise<void> {
  await api.post('/api/auth/logout', { user_id: userId });
}
// // Original logout function
// async function logout() {
//     try {
//         const userData = getCurrentUserData();
//         if (userData) {
//             await fetch('/api/auth/logout', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify({
//                     user_id: userData.userId
//                 })
//             });
//         }
        
//         // Clear localStorage
//         localStorage.removeItem('rp_user_data');
        
//         // Redirect to login
//         window.location.href = '/login';
//     } catch (error) {
//         console.error('Logout error:', error);
//         // Still clear localStorage and redirect
//         localStorage.removeItem('rp_user_data');
//         window.location.href = '/login';
//     }
// }