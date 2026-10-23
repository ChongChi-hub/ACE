import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute, RoleRoute } from './routes/guards/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Fund } from './pages/Fund';
import { Accounts } from './pages/Accounts';
import { Logs } from './pages/Logs';
import { Profile } from './pages/Profile';
import { Forbidden, NotFound } from './pages/ErrorPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/fund" element={<Fund />} />
                  <Route path="/profile" element={<Profile />} />

                  {/* Leader only routes */}
                  <Route element={<RoleRoute allowedRoles={['Leader']} />}>
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/logs" element={<Logs />} />
                  </Route>

                  <Route path="/403" element={<Forbidden />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
