import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Modal,
  Drawer,
  Form,
  Tag,
  Tooltip,
  Dropdown,
  Popconfirm,
  message,
  Grid,
  Empty,
  Skeleton
} from 'antd';
import {
  SearchOutlined,
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  WarningFilled,
  FacebookOutlined,
  IdcardOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import { useIsMobile } from '../hooks/useIsMobile';

export function Members() {
  const { user, activeYear } = useAuth();
  const isMobile = useIsMobile();

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Modal / Drawer state for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form] = Form.useForm();

  const queryClient = useQueryClient();

  // Đọc danh sách thành viên
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['members', activeYear],
    queryFn: async () => {
      const res = await api.get(`/members?year=${activeYear}`);
      return res.data.data;
    }
  });

  const members = data?.members || [];

  // Mutations
  const addMutation = useMutation({
    mutationFn: (values) => api.post(`/members?year=${activeYear}`, values),
    onSuccess: (res) => {
      message.success(res.data.message || 'Thêm thành viên thành công!');
      queryClient.invalidateQueries({ queryKey: ['members', activeYear] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể thêm thành viên!');
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ rowIndex, values }) => api.put(`/members/${rowIndex}?year=${activeYear}`, values),
    onSuccess: (res) => {
      message.success(res.data.message || 'Cập nhật thành công!');
      queryClient.invalidateQueries({ queryKey: ['members', activeYear] });
      setIsModalOpen(false);
      setEditingMember(null);
      form.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể cập nhật thành viên!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ rowIndex, expectedIngame }) =>
      api.delete(`/members/${rowIndex}?year=${activeYear}`, { data: { expectedIngame } }),
    onSuccess: (res) => {
      message.success(res.data.message || 'Đã xoá thành viên!');
      queryClient.invalidateQueries({ queryKey: ['members', activeYear] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể xoá thành viên!');
    }
  });

  // Filter & Search logic
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch =
        !searchText ||
        m.tenIngame.toLowerCase().includes(searchText.toLowerCase()) ||
        String(m.gameId || '').includes(searchText) ||
        (m.facebookName && m.facebookName.toLowerCase().includes(searchText.toLowerCase()));

      const matchRole = roleFilter === 'ALL' || m.chucVu === roleFilter;

      return matchSearch && matchRole;
    });
  }, [members, searchText, roleFilter]);

  // Quyền thêm/sửa/xoá
  const canManageMembers = ['Leader', 'Co-Leader'].includes(user?.role);
  const isLeader = user?.role === 'Leader';

  const handleOpenAdd = () => {
    setEditingMember(null);
    form.resetFields();
    form.setFieldsValue({ chucVu: 'Thành viên' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingMember(record);
    form.setFieldsValue({
      tenIngame: record.tenIngame,
      gameId: record.gameId,
      facebookName: record.facebookName,
      facebookUrl: record.facebookUrl,
      chucVu: record.chucVu
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (values) => {
    if (editingMember) {
      editMutation.mutate({
        rowIndex: editingMember.rowIndex,
        values: {
          ...values,
          expectedIngame: editingMember.tenIngame,
          expectedGameId: editingMember.gameId
        }
      });
    } else {
      addMutation.mutate(values);
    }
  };

  const handleDelete = (record) => {
    deleteMutation.mutate({
      rowIndex: record.rowIndex,
      expectedIngame: record.tenIngame
    });
  };

  // Cột cho Desktop Table
  const columns = [
    {
      title: 'STT',
      dataIndex: 'stt',
      key: 'stt',
      width: 60,
      align: 'center',
      sorter: (a, b) => a.stt - b.stt,
    },
    {
      title: 'Tên Ingame',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      render: (text) => (
        <span className="font-bold text-slate-800 dark:text-slate-100">{text}</span>
      ),
    },
    {
      title: 'ID Game',
      dataIndex: 'gameId',
      key: 'gameId',
      render: (id, record) => (
        <div className="flex items-center gap-1.5 font-mono">
          <span>{id || '---'}</span>
          {record.isDuplicateId && (
            <Tooltip title="Cảnh báo: ID game này bị trùng với thành viên khác!">
              <Tag color="warning" icon={<WarningFilled />} className="mr-0 font-sans text-xs">
                Trùng ID
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Facebook',
      dataIndex: 'facebookName',
      key: 'facebookName',
      render: (name, record) =>
        record.facebookUrl ? (
          <a
            href={record.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline text-xs"
          >
            <FacebookOutlined />
            <span>{name}</span>
          </a>
        ) : (
          <span className="text-xs text-slate-400">{name || '---'}</span>
        ),
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chucVu',
      key: 'chucVu',
      render: (role) => <RoleTag role={role} />,
    },
    {
      title: 'Tổng đóng góp',
      dataIndex: 'tongDongGop',
      key: 'tongDongGop',
      align: 'right',
      sorter: (a, b) => (a.tongDongGop || 0) - (b.tongDongGop || 0),
      render: (amount) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(amount || 0).toLocaleString('vi-VN')} ₫
        </span>
      ),
    },
    ...(canManageMembers
      ? [
          {
            title: 'Thao tác',
            key: 'action',
            align: 'center',
            width: 110,
            render: (_, record) => {
              const canDeleteThis = isLeader || ((record.tongDongGop || 0) <= 0);

              return (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    type="text"
                    icon={<EditOutlined className="text-blue-500" />}
                    onClick={() => handleOpenEdit(record)}
                    size="small"
                  />

                  <Popconfirm
                    title={`Xoá thành viên "${record.tenIngame}"?`}
                    description={
                      !canDeleteThis
                        ? 'Co-Leader không được xoá thành viên đã có đóng góp quỹ > 0!'
                        : 'Thao tác này sẽ xoá dòng trên Google Sheet và đánh lại STT.'
                    }
                    onConfirm={() => handleDelete(record)}
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true, disabled: !canDeleteThis }}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      disabled={!canDeleteThis}
                    />
                  </Popconfirm>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  // Render form Modal/Drawer
  const formContent = (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="tenIngame"
        label="Tên Ingame (bắt buộc, không trùng)"
        rules={[{ required: true, message: 'Vui lòng nhập tên ingame' }]}
      >
        <Input placeholder="Ví dụ: 『ACE』King" />
      </Form.Item>

      <Form.Item
        name="gameId"
        label="ID Game (chỉ chứa số)"
        rules={[{ pattern: /^\d*$/, message: 'ID game chỉ được chứa chữ số' }]}
      >
        <Input placeholder="Ví dụ: 5230497134" inputMode="numeric" />
      </Form.Item>

      <Form.Item name="facebookName" label="Tên hiển thị Facebook">
        <Input placeholder="Ví dụ: Nguyễn Văn A" />
      </Form.Item>

      <Form.Item
        name="facebookUrl"
        label="Link Facebook cá nhân (URL)"
        rules={[{ type: 'url', message: 'Vui lòng nhập đúng định dạng URL' }]}
      >
        <Input placeholder="https://www.facebook.com/username#" />
      </Form.Item>

      <Form.Item
        name="chucVu"
        label="Chức vụ"
        rules={[{ required: true, message: 'Vui lòng chọn chức vụ' }]}
        tooltip={!isLeader ? 'Chỉ Leader mới có quyền thay đổi Chức vụ' : undefined}
      >
        <Select
          disabled={!isLeader}
          options={[
            { label: 'Thành viên', value: 'Thành viên' },
            { label: 'QTV', value: 'QTV' },
            { label: 'Co-Leader', value: 'Co-Leader' },
            ...(isLeader ? [{ label: 'Leader', value: 'Leader' }] : []),
          ]}
        />
      </Form.Item>

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button onClick={() => setIsModalOpen(false)}>Huỷ</Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={addMutation.isPending || editMutation.isPending}
        >
          {editingMember ? 'Lưu thay đổi' : 'Thêm mới'}
        </Button>
      </div>
    </Form>
  );

  return (
    <div className="space-y-4">
      {/* Thanh công cụ tìm kiếm và bộ lọc */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="flex-1 flex gap-2">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo Ingame, ID game, Facebook..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="max-w-md"
            />

            {!isMobile ? (
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                className="w-36"
                options={[
                  { label: 'Tất cả chức vụ', value: 'ALL' },
                  { label: 'Leader', value: 'Leader' },
                  { label: 'Co-Leader', value: 'Co-Leader' },
                  { label: 'QTV', value: 'QTV' },
                  { label: 'Thành viên', value: 'Thành viên' },
                ]}
              />
            ) : (
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerOpen(true)}
              >
                Lọc
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
            />

            {canManageMembers && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleOpenAdd}
                className="touch-target-btn bg-amber-500 hover:bg-amber-600 border-none font-bold"
              >
                Thêm Thành Viên
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Hiển thị danh sách */}
      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
      ) : isMobile ? (
        /* Dạng Mobile Card List */
        <div className="space-y-3">
          {filteredMembers.length === 0 ? (
            <Card><Empty description="Không tìm thấy thành viên phù hợp" /></Card>
          ) : (
            filteredMembers.map((record) => {
              const canDeleteThis = isLeader || ((record.tongDongGop || 0) <= 0);

              const mobileMenu = {
                items: [
                  ...(canManageMembers
                    ? [
                        {
                          key: 'edit',
                          icon: <EditOutlined />,
                          label: 'Chỉnh sửa',
                          onClick: () => handleOpenEdit(record),
                        },
                      ]
                    : []),
                  ...(canManageMembers
                    ? [
                        {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          danger: true,
                          disabled: !canDeleteThis,
                          label: 'Xoá thành viên',
                          onClick: () => {
                            Modal.confirm({
                              title: `Xoá thành viên "${record.tenIngame}"?`,
                              content: !canDeleteThis
                                ? 'Co-Leader không được xoá thành viên đã có đóng góp > 0!'
                                : 'Thao tác sẽ xoá hàng trên sheet và đánh lại STT.',
                              okText: 'Xoá',
                              okButtonProps: { danger: true, disabled: !canDeleteThis },
                              cancelText: 'Huỷ',
                              onOk: () => handleDelete(record),
                            });
                          },
                        },
                      ]
                    : []),
                ],
              };

              return (
                <Card
                  key={record.rowIndex}
                  className="shadow-sm border-slate-200 dark:border-slate-800"
                  bodyStyle={{ padding: '14px 16px' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500">
                        {record.stt}
                      </span>
                      <div>
                        <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                          {record.tenIngame}
                        </div>
                        <div className="mt-1">
                          <RoleTag role={record.chucVu} />
                        </div>
                      </div>
                    </div>

                    {canManageMembers && (
                      <Dropdown menu={mobileMenu} trigger={['click']}>
                        <Button type="text" icon={<MoreOutlined className="text-lg" />} />
                      </Dropdown>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">ID Game:</span>
                      <div className="font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                        {record.gameId || '---'}
                        {record.isDuplicateId && (
                          <Tag color="warning" className="mr-0 text-[10px]">Trùng</Tag>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Facebook:</span>
                      <div className="mt-0.5">
                        {record.facebookUrl ? (
                          <a
                            href={record.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline inline-flex items-center gap-1 truncate max-w-[130px]"
                          >
                            <FacebookOutlined /> {record.facebookName}
                          </a>
                        ) : (
                          <span className="text-slate-400">{record.facebookName || '---'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Tổng đóng góp:</span>
                    <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                      {(record.tongDongGop || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Dạng Desktop Table */
        <Card className="shadow-sm border-slate-200 dark:border-slate-800" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredMembers}
            rowKey="rowIndex"
            pagination={{ pageSize: 15, showTotal: (total) => `Tổng số ${total} thành viên` }}
            scroll={{ x: 750 }}
          />
        </Card>
      )}

      {/* Drawer lọc cho Mobile */}
      <Drawer
        title="Lọc thành viên"
        placement="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        height="auto"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Chức vụ:</label>
            <Select
              value={roleFilter}
              onChange={val => {
                setRoleFilter(val);
                setFilterDrawerOpen(false);
              }}
              className="w-full"
              options={[
                { label: 'Tất cả chức vụ', value: 'ALL' },
                { label: 'Leader', value: 'Leader' },
                { label: 'Co-Leader', value: 'Co-Leader' },
                { label: 'QTV', value: 'QTV' },
                { label: 'Thành viên', value: 'Thành viên' },
              ]}
            />
          </div>
        </div>
      </Drawer>

      {/* Modal / Drawer Thêm & Sửa Thành Viên */}
      {isMobile ? (
        <Drawer
          title={editingMember ? 'Sửa Thông Tin Thành Viên' : 'Thêm Thành Viên Mới'}
          placement="bottom"
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          height="90%"
        >
          {formContent}
        </Drawer>
      ) : (
        <Modal
          title={editingMember ? 'Sửa Thông Tin Thành Viên' : 'Thêm Thành Viên Mới'}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          centered
          width={520}
        >
          {formContent}
        </Modal>
      )}
    </div>
  );
}
