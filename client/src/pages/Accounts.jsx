import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Card,
  Button,
  Switch,
  Tag,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  message,
  Grid,
  Skeleton
} from 'antd';
import {
  UserAddOutlined,
  KeyOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import { useIsMobile } from '../hooks/useIsMobile';
import dayjs from 'dayjs';

export function Accounts() {
  const { user, activeYear } = useAuth();
  const isMobile = useIsMobile();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState(null);

  const [createForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const queryClient = useQueryClient();

  // Đọc danh sách tài khoản
  const { data: accounts = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get('/accounts');
      return res.data.data;
    }
  });

  // Đọc danh sách thành viên để chọn thành viên BQT khi tạo tài khoản
  const { data: membersData } = useQuery({
    queryKey: ['members', activeYear],
    queryFn: async () => {
      const res = await api.get(`/members?year=${activeYear}`);
      return res.data.data;
    }
  });

  const bqtMembers = (membersData?.members || []).filter(m =>
    ['Leader', 'Co-Leader', 'QTV'].includes(m.chucVu)
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values) => api.post('/accounts', values),
    onSuccess: (res) => {
      message.success(res.data.message || 'Tạo tài khoản thành công!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể tạo tài khoản!');
    }
  });

  const fundPermMutation = useMutation({
    mutationFn: ({ username, canEditFund }) =>
      api.patch(`/accounts/${username}/fund-permission`, { canEditFund }),
    onSuccess: (res) => {
      message.success(res.data.message || 'Cập nhật quyền ghi quỹ thành công!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Lỗi cập nhật quyền ghi quỹ!');
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ username, status }) =>
      api.patch(`/accounts/${username}/status`, { status }),
    onSuccess: (res) => {
      message.success(res.data.message || 'Cập nhật trạng thái thành công!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái!');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ username, newPassword }) =>
      api.post(`/accounts/${username}/reset-password`, { newPassword }),
    onSuccess: (res) => {
      message.success(res.data.message || 'Reset mật khẩu thành công!');
      setResetModalUser(null);
      resetForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Lỗi reset mật khẩu!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (username) => api.delete(`/accounts/${username}`),
    onSuccess: (res) => {
      message.success(res.data.message || 'Đã xoá tài khoản!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể xoá tài khoản!');
    }
  });

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{text}</span>
      ),
    },
    {
      title: 'Tên Ingame (Liên kết)',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      render: (text) => <span className="font-bold">{text}</span>,
    },
    {
      title: 'Chức vụ BQT',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <RoleTag role={role} />,
    },
    {
      title: 'Quyền ghi quỹ',
      dataIndex: 'canEditFund',
      key: 'canEditFund',
      render: (canEdit, record) => {
        const isSelfLeader = record.role === 'Leader';

        return (
          <Popconfirm
            title={`Bạn có chắc muốn ${canEdit ? 'thu hồi' : 'cấp'} quyền ghi quỹ cho "${record.username}"?`}
            onConfirm={() =>
              fundPermMutation.mutate({
                username: record.username,
                canEditFund: !canEdit
              })
            }
            disabled={isSelfLeader}
            okText="Xác nhận"
            cancelText="Huỷ"
          >
            <Switch
              checked={canEdit}
              disabled={isSelfLeader || fundPermMutation.isPending}
              checkedChildren="Bật"
              unCheckedChildren="Tắt"
            />
          </Popconfirm>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const isActive = status === 'active';
        const isSelfLeader = record.role === 'Leader';

        return (
          <div className="flex items-center gap-2">
            <Tag color={isActive ? 'success' : 'error'}>
              {isActive ? 'Hoạt động' : 'Đã khoá'}
            </Tag>

            {!isSelfLeader && (
              <Popconfirm
                title={`Bạn có chắc muốn ${isActive ? 'khoá' : 'mở khoá'} tài khoản "${record.username}"?`}
                onConfirm={() =>
                  statusMutation.mutate({
                    username: record.username,
                    status: isActive ? 'disabled' : 'active'
                  })
                }
                okText="Đồng ý"
                cancelText="Huỷ"
              >
                <Button
                  type="text"
                  size="small"
                  icon={isActive ? <StopOutlined className="text-rose-500" /> : <CheckCircleOutlined className="text-emerald-500" />}
                />
              </Popconfirm>
            )}
          </div>
        );
      },
    },
    {
      title: 'Đăng nhập cuối',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (val) => (
        <span className="text-xs text-slate-400">
          {val ? dayjs(val).format('DD/MM/YYYY HH:mm') : 'Chưa đăng nhập'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => {
        const isSelfLeader = record.role === 'Leader';

        return (
          <div className="flex items-center gap-1">
            <Button
              type="text"
              icon={<KeyOutlined className="text-amber-500" />}
              size="small"
              onClick={() => {
                setResetModalUser(record.username);
                resetForm.resetFields();
              }}
              title="Reset mật khẩu"
            />

            {!isSelfLeader && (
              <Popconfirm
                title={`Xoá tài khoản "${record.username}"?`}
                description="Thao tác này chỉ xoá tài khoản đăng nhập, không xoá thành viên trong clan."
                onConfirm={() => deleteMutation.mutate(record.username)}
                okText="Xoá"
                cancelText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 m-0">
              Quản Lý Tài Khoản Ban Quản Trị
            </h2>
            <p className="text-xs text-slate-400 m-0 mt-0.5">
              Chỉ Leader mới có quyền tạo, khoá tài khoản và cấp/thu hồi quyền ghi quỹ.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()} />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setCreateModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
            >
              Cấp Tài Khoản Mới
            </Button>
          </div>
        </div>
      </Card>

      {/* Danh sách tài khoản */}
      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : isMobile ? (
        /* Mobile View Cards */
        <div className="space-y-3">
          {accounts.map(acc => {
            const isSelfLeader = acc.role === 'Leader';
            const isActive = acc.status === 'active';

            return (
              <Card
                key={acc.username}
                className="shadow-sm border-slate-200 dark:border-slate-800"
                bodyStyle={{ padding: '14px 16px' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
                      @{acc.username}
                    </div>
                    <div className="font-semibold text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      {acc.tenIngame}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <RoleTag role={acc.role} />
                      <Tag color={isActive ? 'success' : 'error'}>
                        {isActive ? 'Hoạt động' : 'Đã khoá'}
                      </Tag>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="text"
                      icon={<KeyOutlined className="text-amber-500" />}
                      onClick={() => {
                        setResetModalUser(acc.username);
                        resetForm.resetFields();
                      }}
                    />

                    {!isSelfLeader && (
                      <Popconfirm
                        title={`Xoá tài khoản "${acc.username}"?`}
                        onConfirm={() => deleteMutation.mutate(acc.username)}
                        okText="Xoá"
                        cancelText="Huỷ"
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Cho phép ghi quỹ:</span>
                  <Popconfirm
                    title={`Bạn có chắc muốn ${acc.canEditFund ? 'thu hồi' : 'cấp'} quyền ghi quỹ cho "${acc.username}"?`}
                    onConfirm={() =>
                      fundPermMutation.mutate({
                        username: acc.username,
                        canEditFund: !acc.canEditFund
                      })
                    }
                    disabled={isSelfLeader}
                    okText="Xác nhận"
                    cancelText="Huỷ"
                  >
                    <Switch
                      checked={acc.canEditFund}
                      disabled={isSelfLeader || fundPermMutation.isPending}
                      checkedChildren="Bật"
                      unCheckedChildren="Tắt"
                    />
                  </Popconfirm>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Desktop Table */
        <Card className="shadow-sm border-slate-200 dark:border-slate-800" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={accounts}
            rowKey="username"
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      {/* Modal Cấp Tài Khoản Mới */}
      <Modal
        title="Cấp Tài Khoản Mới Cho Ban Quản Trị"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        centered
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
          className="mt-4"
        >
          <Form.Item
            name="tenIngame"
            label="Chọn thành viên Ban quản trị (Leader, Co-Leader, QTV)"
            rules={[{ required: true, message: 'Vui lòng chọn thành viên' }]}
          >
            <Select
              placeholder="Chọn thành viên"
              options={bqtMembers.map(m => ({
                label: `${m.tenIngame} (${m.chucVu})`,
                value: m.tenIngame
              }))}
            />
          </Form.Item>

          <Form.Item
            name="username"
            label="Tên đăng nhập (Username)"
            rules={[
              { required: true, message: 'Vui lòng nhập username' },
              { min: 3, message: 'Tối thiểu 3 ký tự' },
              { pattern: /^[a-zA-Z0-9_.-]+$/, message: 'Chỉ chứa chữ, số, _, -, .' }
            ]}
          >
            <Input placeholder="Ví dụ: coleader_meoww" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu khởi tạo (tối thiểu 8 ký tự)"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 8, message: 'Mật khẩu phải từ 8 ký tự trở lên' }
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item
            name="canEditFund"
            label="Cấp quyền ghi quỹ ban đầu"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setCreateModalOpen(false)}>Huỷ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
            >
              Tạo Tài Khoản
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Reset Mật Khẩu */}
      <Modal
        title={`Reset Mật Khẩu Cho: ${resetModalUser}`}
        open={Boolean(resetModalUser)}
        onCancel={() => setResetModalUser(null)}
        footer={null}
        centered
      >
        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(values) =>
            resetPasswordMutation.mutate({
              username: resetModalUser,
              newPassword: values.newPassword
            })
          }
          className="mt-4"
        >
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới (tối thiểu 8 ký tự)"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải từ 8 ký tự' }
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu mới" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setResetModalUser(null)}>Huỷ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={resetPasswordMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
            >
              Reset Mật Khẩu
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
