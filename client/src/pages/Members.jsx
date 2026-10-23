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
  Empty,
  Skeleton,
  Segmented
} from 'antd';
import {
  SearchOutlined,
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  WarningFilled,
  FacebookOutlined,
  FilterOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  TableOutlined,
  CopyOutlined,
  CheckOutlined,
  CrownOutlined,
  UsergroupAddOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import { useIsMobile } from '../hooks/useIsMobile';

export function Members() {
  const { user, activeYear } = useAuth();
  const isMobile = useIsMobile();

  // Chế độ xem: 'cards' (Thẻ) hoặc 'table' (Bảng) - Ưu tiên Thẻ trên mobile
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('ace_sun_members_view_mode') || (window.innerWidth < 768 ? 'cards' : 'table');
  });

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

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

  // Copy ID Game
  const handleCopyId = (gameId, e) => {
    if (e) e.stopPropagation();
    if (!gameId) return;
    navigator.clipboard.writeText(String(gameId));
    setCopiedId(gameId);
    message.success(`Đã sao chép ID: ${gameId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleChangeViewMode = (val) => {
    setViewMode(val);
    localStorage.setItem('ace_sun_members_view_mode', val);
  };

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
        <button
          type="button"
          onClick={(e) => handleCopyId(id, e)}
          className="flex items-center gap-1.5 font-mono text-xs hover:text-amber-500 transition cursor-pointer"
          title="Nhấp để sao chép ID"
        >
          <span>{id || '---'}</span>
          {copiedId === id ? (
            <CheckOutlined className="text-emerald-500" />
          ) : (
            <CopyOutlined className="text-slate-400 opacity-60 hover:opacity-100" />
          )}
          {record.isDuplicateId && (
            <Tooltip title="Cảnh báo: ID game này bị trùng với thành viên khác!">
              <Tag color="warning" icon={<WarningFilled />} className="mr-0 font-sans text-[10px]">
                Trùng ID
              </Tag>
            </Tooltip>
          )}
        </button>
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
            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 font-medium hover:underline text-xs"
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
      title: (
        <Tooltip title="TTV: Số lượng thành viên BQT tuyển được">
          <span className="flex items-center justify-center gap-1">
            <span>TTV</span>
            <InfoCircleOutlined className="text-xs text-purple-400" />
          </span>
        </Tooltip>
      ),
      dataIndex: 'ttv',
      key: 'ttv',
      align: 'center',
      width: 80,
      render: (val, record) => {
        const isBQT = ['Leader', 'Co-Leader', 'QTV'].includes(record.chucVu);
        if (!isBQT) {
          return <span className="text-slate-600 font-mono">-</span>;
        }
        return (
          <Tag color="purple" className="font-bold m-0 font-mono text-xs">
            {val || 0} TV
          </Tag>
        );
      }
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
            width: 100,
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
      {/* Thanh công cụ tìm kiếm, lọc & thêm mới */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur" bodyStyle={{ padding: '12px 14px' }}>
        {/* Desktop Toolbar (md:): Trải dài 1 hàng */}
        <div className="hidden md:flex gap-3 justify-between items-center">
          <div className="flex items-center gap-2.5 flex-1">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo Ingame, ID game, Facebook..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="w-64"
            />

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

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Segmented
                value={viewMode}
                onChange={handleChangeViewMode}
                options={[
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
                        <AppstoreOutlined /> Dạng Thẻ
                      </span>
                    ),
                    value: 'cards'
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
                        <TableOutlined /> Dạng Bảng
                      </span>
                    ),
                    value: 'table'
                  }
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
              title="Làm mới dữ liệu"
            />

            {canManageMembers && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleOpenAdd}
                className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
              >
                Thêm Thành Viên
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Toolbar (< md:): Bố cục 2 hàng gọn gàng, chuẩn ngón tay */}
        <div className="flex md:hidden flex-col gap-2.5">
          {/* Hàng 1: Ô tìm kiếm toàn màn hình */}
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm theo Ingame, ID, FB..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            className="w-full"
            size="middle"
          />

          {/* Hàng 2: Nút Thẻ/Bảng, Lọc & Nút Thêm mới */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Segmented
                  value={viewMode}
                  onChange={handleChangeViewMode}
                  options={[
                    {
                      label: (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold">
                          <AppstoreOutlined /> Thẻ
                        </span>
                      ),
                      value: 'cards'
                    },
                    {
                      label: (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold">
                          <TableOutlined /> Bảng
                        </span>
                      ),
                      value: 'table'
                    }
                  ]}
                />
              </div>

              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerOpen(true)}
                size="middle"
                className={roleFilter !== 'ALL' ? 'text-amber-500 border-amber-500 font-bold' : ''}
              >
                {roleFilter !== 'ALL' ? roleFilter : 'Lọc'}
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => refetch()}
                size="middle"
              />

              {canManageMembers && (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleOpenAdd}
                  className="bg-amber-500 hover:bg-amber-600 border-none font-bold text-xs px-2.5"
                  size="middle"
                >
                  Thêm
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Hiển thị danh sách: Dạng Thẻ (Card View) hoặc Dạng Bảng (Table View) */}
      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
      ) : filteredMembers.length === 0 ? (
        <Card><Empty description="Không tìm thấy thành viên phù hợp" /></Card>
      ) : viewMode === 'cards' ? (
        /* DẠNG THẺ (CARD VIEW) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((record) => {
            const canDeleteThis = isLeader || ((record.tongDongGop || 0) <= 0);
            const isRankLeader = record.chucVu === 'Leader';
            const isRankCoLeader = record.chucVu === 'Co-Leader';
            const isRankQtv = record.chucVu === 'QTV';

            return (
              <div
                key={record.rowIndex}
                className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-sm hover:shadow-amber-500/10 transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: STT / Avatar & Action */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isRankLeader
                            ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                            : isRankCoLeader
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/50'
                            : isRankQtv
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isRankLeader ? <CrownOutlined className="text-sm" /> : record.stt}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-500 transition">
                          {record.tenIngame}
                        </div>
                        <div className="mt-0.5">
                          <RoleTag role={record.chucVu} />
                        </div>
                      </div>
                    </div>

                    {/* Huy hiệu TTV (Tuyển thành viên) - Chỉ cho 7 BQT */}
                    {['Leader', 'Co-Leader', 'QTV'].includes(record.chucVu) && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40"
                        title="Số lượng thành viên BQT tuyển được"
                      >
                        <UsergroupAddOutlined className="text-purple-500 dark:text-purple-400" />
                        <span>{record.ttv || 0} TV</span>
                      </div>
                    )}
                  </div>

                  {/* ID Game & Facebook */}
                  <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 mb-3 mt-3">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(record.gameId, e)}
                      className="flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400 hover:text-amber-500 transition cursor-pointer text-[11px]"
                      title="Nhấp để sao chép ID"
                    >
                      <span>ID: <strong className="text-slate-800 dark:text-slate-200">{record.gameId || '---'}</strong></span>
                      {copiedId === record.gameId ? (
                        <CheckOutlined className="text-emerald-500" />
                      ) : (
                        <CopyOutlined className="text-[11px] opacity-60 hover:opacity-100" />
                      )}
                      {record.isDuplicateId && (
                        <Tag color="warning" className="mr-0 text-[10px]">Trùng ID</Tag>
                      )}
                    </button>

                    {record.facebookUrl ? (
                      <a
                        href={record.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 dark:text-blue-400 hover:underline text-[11px] flex items-center gap-1 font-medium"
                      >
                        <FacebookOutlined />
                        <span className="truncate max-w-[90px]">{record.facebookName || 'Facebook'}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[90px]">
                        {record.facebookName || '---'}
                      </span>
                    )}
                  </div>

                  {/* Tổng đóng góp quỹ */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 text-xs mb-3">
                    <span className="text-slate-500 dark:text-slate-400">Tổng đóng góp:</span>
                    <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 font-mono">
                      {(record.tongDongGop || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                {/* Thao tác Sửa / Xoá */}
                {canManageMembers && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEdit(record)}
                      className="text-xs text-blue-400 border-slate-700 hover:border-blue-500"
                    >
                      Sửa
                    </Button>

                    <Popconfirm
                      title={`Xoá thành viên "${record.tenIngame}"?`}
                      description={
                        !canDeleteThis
                          ? 'Co-Leader không được xoá thành viên đã có đóng góp quỹ > 0!'
                          : 'Thao tác sẽ xoá hàng trên sheet và đánh lại STT.'
                      }
                      onConfirm={() => handleDelete(record)}
                      okText="Xoá"
                      cancelText="Huỷ"
                      okButtonProps={{ danger: true, disabled: !canDeleteThis }}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={!canDeleteThis}
                        className="text-xs"
                      >
                        Xoá
                      </Button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* DẠNG BẢNG (TABLE VIEW) */
        <Card className="shadow-sm border-slate-200 dark:border-slate-800" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredMembers}
            rowKey="rowIndex"
            pagination={{ pageSize: 15, showTotal: (total) => `Tổng số ${total} thành viên` }}
            scroll={{ x: 850 }}
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

      {/* Modal / Drawer thêm & chỉnh sửa thành viên */}
      {isMobile ? (
        <Drawer
          title={editingMember ? 'Chỉnh sửa thành viên' : 'Thêm thành viên mới'}
          placement="bottom"
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          height="auto"
        >
          {formContent}
        </Drawer>
      ) : (
        <Modal
          centered
          title={editingMember ? 'Chỉnh sửa thành viên' : 'Thêm thành viên mới'}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          destroyOnClose
        >
          {formContent}
        </Modal>
      )}
    </div>
  );
}
