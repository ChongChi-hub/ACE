import React, { useState } from 'react';
import { Card, Button, Avatar, Descriptions, Tag, Typography } from 'antd';
import { UserOutlined, KeyOutlined, CrownFilled, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { RoleTag, FundPermissionTag, MemberPermissionTag } from '../components/RoleTag';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

const { Title, Text } = Typography;

export function Profile() {
  const { user } = useAuth();
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 text-center py-6">
        <Avatar
          size={84}
          style={{ backgroundColor: user?.role === 'Leader' ? '#d97706' : '#2563eb' }}
          icon={<UserOutlined />}
          className="shadow-lg mb-3"
        />

        <Title level={3} className="m-0 font-heading font-bold text-slate-800 dark:text-slate-100">
          {user?.tenIngame}
        </Title>
        <Text type="secondary" className="font-mono text-sm">@{user?.username}</Text>

        <div className="mt-3 flex justify-center items-center gap-2 flex-wrap">
          <RoleTag role={user?.role} />
          <FundPermissionTag canEditFund={user?.canEditFund} />
          <MemberPermissionTag canManageMembers={user?.canManageMembers} />
        </div>
      </Card>

      <Card
        title={<span className="font-heading font-bold">Chi Tiết Quyền Hạn Tài Khoản</span>}
        className="shadow-sm border-slate-200 dark:border-slate-800"
      >
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Tên Ingame">{user?.tenIngame}</Descriptions.Item>
          <Descriptions.Item label="Tên Đăng Nhập">@{user?.username}</Descriptions.Item>
          <Descriptions.Item label="Chức Vụ BQT">
            <RoleTag role={user?.role} />
          </Descriptions.Item>
          <Descriptions.Item label="Quyền Ghi Quỹ">
            {user?.role === 'Leader' ? (
              <Tag color="success">Toàn quyền (Leader)</Tag>
            ) : user?.canEditFund ? (
              <Tag color="success">Được Leader cấp phép</Tag>
            ) : (
              <Tag color="default">Chỉ xem (Chưa được cấp phép)</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Quyền Quản Lý Thành Viên">
            {user?.role === 'Leader' ? (
              <Tag color="purple">Toàn quyền (Leader)</Tag>
            ) : user?.canManageMembers ? (
              <Tag color="purple">Được Leader cấp phép</Tag>
            ) : (
              <Tag color="default">Không có quyền (Chưa được cấp phép)</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        <div className="mt-6 flex justify-end">
          <Button
            type="primary"
            icon={<KeyOutlined />}
            onClick={() => setChangePwdOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
          >
            Đổi Mật Khẩu
          </Button>
        </div>
      </Card>

      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </div>
  );
}
