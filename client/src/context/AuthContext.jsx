import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ace_sun_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeYear, setActiveYear] = useState(() => {
    return localStorage.getItem('ace_sun_year') || '2026';
  });
  const [availableYears, setAvailableYears] = useState(['2026', '2027']);
  const [lastSyncTime, setLastSyncTime] = useState(dayjs().format('HH:mm:ss'));
  const [loading, setLoading] = useState(true);

  // Lưu activeYear
  const handleSetActiveYear = (year) => {
    setActiveYear(year);
    localStorage.setItem('ace_sun_year', year);
  };

  // Nạp lại thông tin người dùng từ máy chủ
  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('ace_sun_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('ace_sun_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra phiên:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.user) {
      localStorage.setItem('ace_sun_token', res.data.accessToken);
      localStorage.setItem('ace_sun_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.message || 'Đăng nhập thất bại');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('ace_sun_token');
      localStorage.removeItem('ace_sun_user');
      setUser(null);
      window.location.hash = '#/login';
    }
  };

  const updateLastSync = () => {
    setLastSyncTime(dayjs().format('HH:mm:ss'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeYear,
        setActiveYear: handleSetActiveYear,
        availableYears,
        setAvailableYears,
        lastSyncTime,
        updateLastSync,
        login,
        logout,
        refreshMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
