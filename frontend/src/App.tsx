import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Start } from './pages/Start';
import { Story } from './pages/Story';
import { Recordings } from './pages/Recordings';
import './App.css';
import { getCurrentUserId } from './utils/storage';

// 인증 가드 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const userId = getCurrentUserId();
  
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/start"
          element={
            <ProtectedRoute>
              <Start />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Story />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recordings"
          element={
            <ProtectedRoute>
              <Recordings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App
