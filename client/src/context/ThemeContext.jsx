import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('ace_sun_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('ace_sun_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Ant Design v5 Theme Configuration
  const themeConfig = {
    locale: viVN,
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#d97706', // Amber-600 hoàng kim PUBG
      colorInfo: '#d97706',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
      borderRadius: 10,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      colorBgBase: isDark ? '#0b1120' : '#ffffff',
      colorBgContainer: isDark ? '#111827' : '#ffffff',
      colorBgElevated: isDark ? '#1f2937' : '#ffffff',
      colorBorder: isDark ? '#374151' : '#e5e7eb',
      fontSize: 14,
    },
    components: {
      Button: {
        controlHeight: 40,
        borderRadius: 8,
        fontWeight: 600,
      },
      Table: {
        borderRadius: 12,
        headerBg: isDark ? '#1e293b' : '#f8fafc',
        headerColor: isDark ? '#f1f5f9' : '#0f172a',
      },
      Card: {
        borderRadiusLG: 14,
      },
      Modal: {
        borderRadiusLG: 16,
      },
      Drawer: {
        borderRadiusSM: 16,
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ConfigProvider theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
