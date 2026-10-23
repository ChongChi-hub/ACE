import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined, CrownFilled } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950 relative overflow-hidden">
      {/* Hiệu ứng nền PUBG */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white shadow-xl shadow-amber-500/20 mb-4 animate-bounce">
            <CrownFilled className="text-4xl text-white" />
          </div>
          <Title level={2} className="!text-white font-heading font-black tracking-wider m-0">
            『ACE SUN』
          </Title>
          <Text className="text-amber-400/80 font-medium tracking-widest text-xs uppercase">
            Hệ Thống Quản Trị Clan PUBG Mobile
          </Text>
        </div>

        <Card className="shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-xl">
          {errorMsg && (
            <Alert
              message="Đăng nhập thất bại"
              description={errorMsg}
              type="error"
              showIcon
              className="mb-6 rounded-lg"
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
            >
              <Input
                prefix={<UserOutlined className="text-amber-500" />}
                placeholder="Tên đăng nhập (Username)"
                className="bg-slate-800/50 border-slate-700 text-white placeholder-slate-500"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-amber-500" />}
                placeholder="Mật khẩu"
                className="bg-slate-800/50 border-slate-700 text-white placeholder-slate-500"
              />
            </Form.Item>

            <Form.Item className="mt-6 mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-none shadow-lg shadow-amber-500/30"
              >
                Đăng Nhập Quản Trị
              </Button>
            </Form.Item>
          </Form>

          <div className="mt-4 text-center">
            <Text className="text-xs text-slate-400">
              Chỉ dành cho Ban quản trị (Leader, Co-Leader, QTV).
            </Text>
          </div>
        </Card>

        <div className="text-center mt-6 text-xs text-slate-500">
          Clan ACE SUN © 2026 • Bảo mật dữ liệu trên Google Sheets
        </div>
      </div>
    </div>
  );
}
