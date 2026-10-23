import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Select,
  Tooltip,
  Drawer,
  Grid,
  Breadcrumb
} from 'antd';
import {
  MenuOutlined,
  DashboardOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  UsergroupAddOutlined,
  HistoryOutlined,
  UserOutlined,
  SyncOutlined,
  LogoutOutlined,
  KeyOutlined,
  SunOutlined,
  MoonOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RoleTag, FundPermissionTag } from '../components/RoleTag';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { useQueryClient } from '@tanstack/react-query';
import logoImg from '../assets/logo.png';

const { Header, Sider, Content, Footer } = Layout;

export function MainLayout() {
  const { user, logout, activeYear, setActiveYear, availableYears, lastSyncTime, updateLastSync } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isMobile = useIsMobile();

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await queryClient.invalidateQueries();
      updateLastSync();
    } finally {
      setTimeout(() => setSyncing(false), 500);
    }
  };

  // Tự động đồng bộ toàn hệ thống mỗi 1 phút (60 giây)
  useEffect(() => {
    const timer = setInterval(() => {
      handleManualSync();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Các mục điều hướng dựa theo Role
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/members',
      icon: <TeamOutlined />,
      label: 'Thành viên',
    },
    {
      key: '/fund',
      icon: <DollarCircleOutlined />,
      label: 'Quỹ Clan',
    },
    ...(user?.role === 'Leader'
      ? [
          {
            key: '/accounts',
            icon: <UsergroupAddOutlined />,
            label: 'Tài khoản BQT',
          },
          {
            key: '/logs',
            icon: <HistoryOutlined />,
            label: 'Nhật ký Sheet',
          },
        ]
      : []),
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const currentPath = '/' + (location.pathname.split('/')[1] || 'dashboard');

  // Breadcrumbs title mapping
  const routeTitles = {
    '/dashboard': 'Tổng quan',
    '/members': 'Danh sách thành viên',
    '/fund': 'Quản lý thu quỹ Clan',
    '/accounts': 'Quản lý tài khoản Ban quản trị',
    '/logs': 'Lịch sử thao tác Google Sheet',
    '/profile': 'Thông tin cá nhân'
  };

  const userDropdownItems = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div className="py-1">
          <div className="font-bold text-slate-800 dark:text-slate-100">{user?.tenIngame}</div>
          <div className="text-xs text-slate-400 font-mono">@{user?.username}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <RoleTag role={user?.role} />
            <FundPermissionTag canEditFund={user?.canEditFund} />
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'change-pwd',
      icon: <KeyOutlined />,
      label: 'Đổi mật khẩu',
      onClick: () => setChangePwdOpen(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: 'Đăng xuất',
      onClick: logout,
    },
  ];

  return (
    <Layout className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* 1. Header cố định trên cùng */}
      <Header className="sticky top-0 z-40 w-full px-2 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileDrawerOpen(true)}
              className="text-slate-700 dark:text-slate-200 p-1.5"
            />
          ) : null}

          <Link to="/dashboard" className="flex items-center gap-1.5 sm:gap-2.5 text-inherit no-underline select-none min-w-0">
            <img
              src={logoImg}
              alt="Clan ACE SUN"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-amber-500/90 shadow-md shadow-amber-500/30 flex-shrink-0"
            />
            <div className="flex flex-col justify-center leading-tight min-w-0">
              <span className="font-heading font-black tracking-wider text-sm sm:text-base md:text-lg bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent truncate">
                『ACE SUN』
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-wider uppercase hidden xs:inline sm:inline">
                PUBG MOBILE CLAN
              </span>
            </div>
          </Link>
        </div>

        {/* Thanh công cụ phải */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          {/* Chọn năm: gọn gàng trên mobile không bị tràn chữ */}
          <Select
            value={activeYear}
            onChange={setActiveYear}
            options={availableYears.map(y => ({ label: isMobile ? y : `Năm ${y}`, value: y }))}
            className="w-[88px] sm:w-28"
            size="middle"
          />

          {/* Nút Đồng bộ */}
          <Tooltip title={`Đồng bộ lần cuối: ${lastSyncTime}`}>
            <Button
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleManualSync}
              className="flex items-center justify-center border-slate-300 dark:border-slate-700 px-2 sm:px-3"
            >
              <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
                {lastSyncTime}
              </span>
            </Button>
          </Tooltip>

          {/* Toggle Dark mode */}
          <Button
            type="text"
            icon={isDark ? <SunOutlined className="text-amber-400" /> : <MoonOutlined className="text-slate-600" />}
            onClick={toggleTheme}
            className="rounded-full flex items-center justify-center p-2"
          />

          {/* User Profile Dropdown */}
          <Dropdown menu={{ items: userDropdownItems }} trigger={['click']} placement="bottomRight">
            <div className="flex items-center gap-1.5 cursor-pointer p-0.5 sm:p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <Avatar
                size={isMobile ? 'small' : 'default'}
                style={{ backgroundColor: user?.role === 'Leader' ? '#d97706' : '#2563eb' }}
                icon={<UserOutlined />}
              />
              <span className="hidden lg:inline text-sm font-semibold max-w-[120px] truncate text-slate-700 dark:text-slate-200">
                {user?.tenIngame}
              </span>
            </div>
          </Dropdown>
        </div>
      </Header>

      <Layout className="bg-transparent">
        {/* 2. Desktop Sider */}
        {!isMobile && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            width={240}
            className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-64px)]"
            theme={isDark ? 'dark' : 'light'}
          >
            <Menu
              mode="inline"
              selectedKeys={[currentPath]}
              items={menuItems}
              onClick={handleMenuClick}
              className="border-none mt-3 font-medium text-slate-700 dark:text-slate-200"
            />
          </Sider>
        )}

        {/* 3. Mobile Navigation Drawer */}
        {isMobile && (
          <Drawer
            title={
              <div className="flex items-center gap-2.5">
                <img
                  src={logoImg}
                  alt="Clan ACE SUN"
                  className="w-7 h-7 rounded-full object-cover border border-amber-500 shadow-sm"
                />
                <span className="font-heading font-bold text-amber-500 tracking-wider">ACE SUN MENU</span>
              </div>
            }
            placement="left"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            width={280}
            bodyStyle={{ padding: 0 }}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="font-bold text-base text-slate-800 dark:text-slate-100">{user?.tenIngame}</div>
              <div className="text-xs text-slate-400 mb-2">@{user?.username}</div>
              <div className="flex flex-wrap gap-1">
                <RoleTag role={user?.role} />
                <FundPermissionTag canEditFund={user?.canEditFund} />
              </div>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[currentPath]}
              items={menuItems}
              onClick={handleMenuClick}
              className="border-none py-2"
            />
          </Drawer>
        )}

        {/* 4. Main Page Content */}
        <Content className="p-3 sm:p-5 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {/* Breadcrumb & Tiêu đề trang */}
          <div className="mb-5 flex flex-col gap-1">
            <Breadcrumb
              items={[
                { title: <Link to="/dashboard">Trang chủ</Link> },
                { title: routeTitles[currentPath] || 'ACE SUN' },
              ]}
              className="text-xs text-slate-400"
            />
            <div className="flex items-center justify-between">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-800 dark:text-slate-100 m-0">
                {routeTitles[currentPath] || 'Hệ Thống Quản Lý Clan'}
              </h1>
            </div>
          </div>

          <Outlet />
        </Content>
      </Layout>

      {/* 5. Mobile Bottom Tab Bar (Cố định ở đáy cho < 768px) */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1 safe-bottom shadow-lg flex justify-around items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 border-none bg-transparent cursor-pointer transition ${
              currentPath === '/dashboard' ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <DashboardOutlined className="text-lg" />
            <span className="text-[11px] mt-0.5">Tổng quan</span>
          </button>

          <button
            onClick={() => navigate('/members')}
            className={`flex flex-col items-center justify-center py-1 px-3 border-none bg-transparent cursor-pointer transition ${
              currentPath === '/members' ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <TeamOutlined className="text-lg" />
            <span className="text-[11px] mt-0.5">Thành viên</span>
          </button>

          <button
            onClick={() => navigate('/fund')}
            className={`flex flex-col items-center justify-center py-1 px-3 border-none bg-transparent cursor-pointer transition ${
              currentPath === '/fund' ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <DollarCircleOutlined className="text-lg" />
            <span className="text-[11px] mt-0.5">Quỹ</span>
          </button>

          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-3 border-none bg-transparent cursor-pointer text-slate-500 dark:text-slate-400 transition"
          >
            <AppstoreOutlined className="text-lg" />
            <span className="text-[11px] mt-0.5">Menu</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <Footer className="text-center text-xs text-slate-400 dark:text-slate-500 py-4 bg-transparent hidden md:block">
        CLAN PUBG MOBILE 『ACE SUN』 • Hệ Thống Quản Trị Google Sheets v2.0
      </Footer>

      {/* Modal đổi mật khẩu */}
      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </Layout>
  );
}
