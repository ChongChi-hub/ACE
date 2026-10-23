import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined, CrownFilled } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoImg from '../assets/logo.png';

const { Title, Text } = Typography;

export function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login, user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Nếu đã đăng nhập thì chuyển hướng vào dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const from = location.state?.from?.pathname || '/dashboard';

  const onFinish = async (values) => {
    try {
      setLoading(true);
      setErrorMsg('');
      await login(values.username, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Đăng nhập không thành công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950 relative overflow-y-auto select-none">
      {/* Hiệu ứng nền PUBG */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Form đăng nhập luôn nằm chính giữa màn hình */}
      <div className="w-full max-w-sm sm:max-w-md relative z-10 flex flex-col items-center my-0">
        <div className="text-center mb-5">
          <img
            src={logoImg}
            alt="Clan ACE SUN"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mx-auto mb-3 border-4 border-amber-500 shadow-2xl shadow-amber-500/40 hover:scale-105 transition-transform"
          />
          <Title level={2} className="!text-white font-heading font-black tracking-wider m-0 text-2xl md:text-3xl">
            『ACE SUN』
          </Title>
          <Text className="text-amber-400 font-bold tracking-widest text-[11px] uppercase">
            Hệ Thống Quản Trị Clan PUBG Mobile
          </Text>
        </div>

        <Card className="login-card w-full shadow-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-xl rounded-2xl">
          {errorMsg && (
            <Alert
              message="Đăng nhập thất bại"
              description={errorMsg}
              type="error"
              showIcon
              className="mb-5 rounded-lg"
            />
          )}

          <Form
            name="login_form"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập tài khoản!' }]}
              className="mb-4"
            >
              <Input
                prefix={<UserOutlined className="text-amber-400 text-lg mr-2" />}
                placeholder="Tên đăng nhập (Username)"
                className="h-12 text-white font-medium"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              className="mb-4"
            >
              <Input.Password
                prefix={<LockOutlined className="text-amber-400 text-lg mr-2" />}
                placeholder="Mật khẩu"
                className="h-12 text-white font-medium"
              />
            </Form.Item>

            <Form.Item className="mt-5 mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-12 text-base font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-none shadow-lg shadow-amber-500/30"
              >
                Đăng Nhập Quản Trị
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
            <Text className="text-xs text-slate-400">
              Chỉ dành cho Ban quản trị (Leader, Co-Leader, QTV).
            </Text>
          </div>
        </Card>

        <div className="text-center mt-6 text-[11px] sm:text-xs text-slate-500 px-4 leading-relaxed">
          Clan ACE SUN © 2026<br className="sm:hidden" /> • Bảo mật dữ liệu Google Sheets & GitHub Pages
        </div>
      </div>
    </div>
  );
}
