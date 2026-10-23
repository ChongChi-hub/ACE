import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Drawer,
  Modal,
  Form,
  InputNumber,
  message,
  Tooltip,
  Skeleton,
  Empty,
  Segmented
} from 'antd';
import {
  DollarCircleOutlined,
  SearchOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  TableOutlined,
  UsergroupAddOutlined,
  CrownOutlined,
  NotificationOutlined,
  CopyOutlined,
  CheckOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import dayjs from 'dayjs';

export function Fund() {
  const { user, activeYear } = useAuth();

  // Chế độ xem: 'cards' (Thẻ) hoặc 'table' (Bảng) - Ưu tiên Thẻ trên mobile
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('ace_sun_fund_view_mode') || (window.innerWidth < 768 ? 'cards' : 'table');
  });

  const [searchText, setSearchText] = useState('');
  const [unpaidMonthFilter, setUnpaidMonthFilter] = useState('ALL');

  // Edit Fund Drawer / Modal
  const [editingCell, setEditingCell] = useState(null); // { member, field, fieldLabel, currentAmount }
  const [form] = Form.useForm();

  // Báo cáo nhanh Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const currentRealMonth = Math.min(12, Math.max(1, dayjs().month() + 1));
  const [reportMonth, setReportMonth] = useState(currentRealMonth);
  const [reportContent, setReportContent] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  const queryClient = useQueryClient();

  const canEditFund = user?.role === 'Leader' || user?.canEditFund === true;

  // Đọc dữ liệu quỹ
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['members', activeYear],
    queryFn: async () => {
      const res = await api.get(`/members?year=${activeYear}`);
      return res.data.data;
    }
  });

  const members = data?.members || [];
  const totalRow = data?.totalRow || {};

  // Mutation cập nhật quỹ hoặc TTV
  const recordFundMutation = useMutation({
    mutationFn: (payload) =>
      api.post(`/fund/record?year=${activeYear}`, payload),
    onSuccess: (res) => {
      message.success(res.data.message || 'Ghi nhận thành công!');
      queryClient.invalidateQueries({ queryKey: ['members', activeYear] });
      queryClient.invalidateQueries({ queryKey: ['fund', activeYear] });
      queryClient.invalidateQueries({ queryKey: ['ttv-race', activeYear] });
      setEditingCell(null);
      form.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể ghi nhận!');
    }
  });

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch =
        !searchText ||
        m.tenIngame.toLowerCase().includes(searchText.toLowerCase()) ||
        String(m.gameId || '').includes(searchText);

      if (!matchSearch) return false;

      if (unpaidMonthFilter !== 'ALL') {
        const monthNum = parseInt(unpaidMonthFilter, 10);
        return (m.months?.[monthNum] || 0) === 0;
      }

      return true;
    });
  }, [members, searchText, unpaidMonthFilter]);

  // Danh sách chưa đóng quỹ cho tháng báo cáo
  const unpaidForReport = useMemo(() => {
    return members.filter(m => (m.months?.[reportMonth] || 0) === 0);
  }, [members, reportMonth]);

  // Tự động soạn sẵn nội dung báo cáo khi mở modal hoặc đổi tháng
  useEffect(() => {
    if (reportModalOpen) {
      const listText = unpaidForReport
        .map((m, idx) => `${idx + 1}. ${m.tenIngame} (${m.chucVu})`)
        .join('\n');

      const template =
        `📢 THÔNG BÁO QUỸ CLAN 『ACE SUN』- THÁNG ${reportMonth}/${activeYear} 📢\n\n` +
        `Kính gửi toàn thể anh em clan ACE SUN,\n` +
        `BQT xin gửi danh sách thành viên CHƯA ĐÓNG QUỸ Tháng ${reportMonth}/${activeYear} tính đến thời điểm hiện tại:\n\n` +
        `❌ DANH SÁCH CHƯA HOÀN THÀNH (${unpaidForReport.length}/${members.length} thành viên):\n` +
        (unpaidForReport.length > 0
          ? `${listText}`
          : `🎉 Tuyệt vời! 100% thành viên clan đã hoàn thành đóng quỹ Tháng ${reportMonth}!`) +
        `\n\n` +
        `💰 Mức đóng quỹ: 50.000 VNĐ / tháng\n` +
        `💳 Thông tin đóng quỹ: Vui lòng chuyển khoản cho BQT hoặc liên hệ Leader 『ACE』TỷTỷ.\n` +
        `👉 Cú pháp chuyển khoản: [Tên Ingame] dong quy T${reportMonth}\n\n` +
        `⚠️ Anh em vui lòng sắp xếp hoàn thành sớm để BQT chốt sổ quỹ tháng này nhé!\n` +
        `👑 BAN QUẢN TRỊ CLAN 『ACE SUN』 👑`;

      setReportContent(template);
      setCopiedReport(false);
    }
  }, [reportModalOpen, reportMonth, unpaidForReport, activeYear, members.length]);

  const handleOpenReportModal = () => {
    setReportMonth(currentRealMonth);
    setReportModalOpen(true);
  };

  const handleCopyReportContent = () => {
    if (!reportContent) return;
    navigator.clipboard.writeText(reportContent);
    setCopiedReport(true);
    message.success('Đã sao chép nội dung báo cáo! Bạn có thể dán ngay vào Zalo / Messenger.');
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // Mở drawer/modal sửa quỹ
  const handleOpenEdit = (member, field, fieldLabel, currentAmount) => {
    if (!canEditFund) return;
    setEditingCell({
      rowIndex: member.rowIndex,
      member: member.tenIngame,
      field,
      fieldLabel,
      currentAmount: currentAmount || 0
    });
    form.setFieldsValue({
      amount: currentAmount || 0,
      month: currentRealMonth
    });
  };

  const handleSaveFund = (values) => {
    if (!editingCell) return;
    recordFundMutation.mutate({
      rowIndex: editingCell.rowIndex,
      field: editingCell.field,
      month: values.month || currentRealMonth,
      amount: values.amount ?? 0
    });
  };

  // Nút nhanh tiền đóng quỹ
  const handleQuickPayMoney = (amount = 50000) => {
    form.setFieldsValue({ amount });
  };

  // Nút nhanh số lượng TV tuyển (TTV)
  const handleQuickSetTtv = (deltaOrSet, isDelta = false) => {
    if (isDelta) {
      const cur = form.getFieldValue('amount') || 0;
      form.setFieldsValue({ amount: Math.max(0, cur + deltaOrSet) });
    } else {
      form.setFieldsValue({ amount: deltaOrSet });
    }
  };

  const handleChangeViewMode = (val) => {
    setViewMode(val);
    localStorage.setItem('ace_sun_fund_view_mode', val);
  };

  // Desktop Table Columns
  const columns = [
    {
      title: 'STT',
      dataIndex: 'stt',
      key: 'stt',
      width: 70,
      fixed: 'left',
      align: 'center',
      className: 'whitespace-nowrap font-bold text-center',
      render: (val) => <span className="font-bold text-xs">{val}</span>,
    },
    {
      title: 'Tên Ingame',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      width: 180,
      fixed: 'left',
      className: 'whitespace-nowrap',
      render: (text) => (
        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap block">
          {text}
        </span>
      ),
    },
    // Tháng 1..12
    ...Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      return {
        title: `T${monthNum}`,
        key: `month_${monthNum}`,
        width: 76,
        align: 'right',
        render: (_, record) => {
          const val = record.months?.[monthNum] || 0;
          const isPaid = val > 0;

          return (
            <div
              onClick={() => canEditFund && handleOpenEdit(record, `month_${monthNum}`, `Tháng ${monthNum}`, val)}
              className={`p-1.5 rounded transition text-xs font-mono select-none text-center ${
                canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : 'cursor-default'
              } ${
                isPaid
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800/60'
                  : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-transparent'
              }`}
            >
              {isPaid ? `${(val / 1000).toFixed(0)}k` : '-'}
            </div>
          );
        },
      };
    }),
    {
      title: 'Ủng hộ',
      dataIndex: 'ungHo',
      key: 'ungHo',
      width: 85,
      align: 'right',
      render: (val, record) => (
        <div
          onClick={() => canEditFund && handleOpenEdit(record, 'ungHo', 'Ủng hộ clan', val)}
          className={`p-1.5 rounded text-xs font-mono font-semibold text-center ${
            canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : ''
          } ${val > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60' : 'text-slate-400'}`}
        >
          {val > 0 ? `${(val / 1000).toFixed(0)}k` : '-'}
        </div>
      ),
    },
    {
      title: 'Phạt',
      dataIndex: 'tienPhat',
      key: 'tienPhat',
      width: 80,
      align: 'right',
      render: (val, record) => (
        <div
          onClick={() => canEditFund && handleOpenEdit(record, 'tienPhat', 'Tiền phạt', val)}
          className={`p-1.5 rounded text-xs font-mono font-semibold text-center ${
            canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : ''
          } ${val > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60' : 'text-slate-400'}`}
        >
          {val > 0 ? `${(val / 1000).toFixed(0)}k` : '-'}
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="TTV: Số lượng thành viên tuyển được (Áp dụng cho toàn Clan)">
          <span className="flex items-center justify-center gap-1 font-semibold text-purple-600 dark:text-purple-300">
            <span>TTV</span>
            <InfoCircleOutlined className="text-xs" />
          </span>
        </Tooltip>
      ),
      dataIndex: 'ttv',
      key: 'ttv',
      width: 80,
      align: 'center',
      render: (val, record) => {
        return (
          <div
            onClick={() => canEditFund && handleOpenEdit(record, 'ttv', 'Số lượng TV tuyển được (TTV)', val || 0)}
            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-bold transition ${
              canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-purple-500 hover:scale-105 active:scale-95' : 'cursor-default'
            } bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-600/50 shadow-xs`}
            title={canEditFund ? 'Nhấp để ghi nhận số TV tuyển được' : 'Số lượng thành viên tuyển được'}
          >
            {val || 0} TV
          </div>
        );
      },
    },
    {
      title: 'Tổng đóng góp',
      dataIndex: 'tongDongGop',
      key: 'tongDongGop',
      width: 125,
      fixed: 'right',
      align: 'right',
      render: (val) => (
        <span className="font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
          {(val || 0).toLocaleString('vi-VN')} ₫
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <Card
        className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur"
        bodyStyle={{ padding: '12px 14px' }}
      >
        {/* Desktop Toolbar (md:): Toàn bộ trên 1 hàng phẳng phiu duy nhất */}
        <div className="hidden md:flex items-center justify-between gap-3 overflow-x-auto flex-nowrap py-0.5">
          {/* Nhóm bên trái: Quyền, Chế độ xem & Năm */}
          <div className="flex items-center gap-2.5 flex-shrink-0 flex-nowrap">
            {canEditFund ? (
              <Tag color="success" icon={<EditOutlined />} className="font-bold py-1 px-2.5 text-xs m-0 whitespace-nowrap">
                Bạn có quyền ghi quỹ
              </Tag>
            ) : (
              <Tag color="default" icon={<LockOutlined />} className="font-medium py-1 px-2.5 text-xs m-0 whitespace-nowrap">
                Chế độ chỉ xem
              </Tag>
            )}

            {/* Nút chuyển đổi Dạng Thẻ / Dạng Bảng */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0">
              <Segmented
                value={viewMode}
                onChange={handleChangeViewMode}
                options={[
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                        <AppstoreOutlined /> Dạng Thẻ
                      </span>
                    ),
                    value: 'cards'
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                        <TableOutlined /> Dạng Bảng
                      </span>
                    ),
                    value: 'table'
                  }
                ]}
              />
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 hidden 2xl:inline whitespace-nowrap">
              (Năm: {activeYear} • Nhấp ô để sửa)
            </span>
          </div>

          {/* Nhóm bên phải: Tìm kiếm, Lọc tháng, Nút Báo Cáo Nhanh & Reload */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm ingame, ID..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="w-36 sm:w-44"
              size="middle"
            />

            <Select
              value={unpaidMonthFilter}
              onChange={setUnpaidMonthFilter}
              className="w-36 sm:w-40"
              size="middle"
              options={[
                { label: 'Tất cả thành viên', value: 'ALL' },
                ...Array.from({ length: 12 }, (_, i) => ({
                  label: `Chưa đóng Tháng ${i + 1}`,
                  value: String(i + 1)
                }))
              ]}
            />

            {/* Nút Báo Cáo Nhanh (Thay thế nút Xuất Excel) */}
            <Button
              type="primary"
              icon={<NotificationOutlined />}
              onClick={handleOpenReportModal}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold whitespace-nowrap flex items-center shadow-sm"
              size="middle"
            >
              Báo cáo nhanh
            </Button>

            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
              size="middle"
              className="flex-shrink-0"
              title="Làm mới dữ liệu"
            />
          </div>
        </div>

        {/* Mobile Toolbar (< md:): Bố cục 2 hàng thông minh, không bị che khuất */}
        <div className="flex md:hidden flex-col gap-2.5">
          {/* Hàng 1: Chuyển dạng Thẻ/Bảng & Nút Báo cáo nhanh */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Segmented
                value={viewMode}
                onChange={handleChangeViewMode}
                options={[
                  {
                    label: (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold">
                        <AppstoreOutlined /> Thẻ
                      </span>
                    ),
                    value: 'cards'
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold">
                        <TableOutlined /> Bảng
                      </span>
                    ),
                    value: 'table'
                  }
                ]}
              />
            </div>

            <Button
              type="primary"
              icon={<NotificationOutlined />}
              onClick={handleOpenReportModal}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold text-xs flex items-center shadow-sm px-3"
              size="middle"
            >
              Báo cáo nhanh
            </Button>
          </div>

          {/* Hàng 2: Tìm kiếm, Lọc tháng & Nút Reload */}
          <div className="flex items-center gap-2">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm ingame, ID..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="flex-1"
              size="middle"
            />

            <Select
              value={unpaidMonthFilter}
              onChange={setUnpaidMonthFilter}
              className="w-28 flex-shrink-0"
              size="middle"
              options={[
                { label: 'Tất cả', value: 'ALL' },
                ...Array.from({ length: 12 }, (_, i) => ({
                  label: `Chưa T${i + 1}`,
                  value: String(i + 1)
                }))
              ]}
            />

            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
              size="middle"
              className="flex-shrink-0"
              title="Làm mới dữ liệu"
            />
          </div>
        </div>
      </Card>

      {/* 2. Dữ liệu Quỹ: Thẻ (Card View) hoặc Bảng (Table View) */}
      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>
      ) : filteredMembers.length === 0 ? (
        <Card><Empty description="Không có dữ liệu phù hợp" /></Card>
      ) : viewMode === 'cards' ? (
        /* DẠNG THẺ (CARD VIEW) - Tối giản, chỉ hiện Tên, Role, TTV (BQT) và Lưới 12 Tháng, KHÔNG CẦN TỔNG ĐÓNG GÓP */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredMembers.map((m) => {
            const isLeader = m.chucVu === 'Leader';
            const isCoLeader = m.chucVu === 'Co-Leader';
            const isQtv = m.chucVu === 'QTV';
            const isBQT = isLeader || isCoLeader || isQtv;

            return (
              <div
                key={m.rowIndex}
                className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 shadow-sm hover:shadow-amber-500/10 transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Header: Avatar/Rank, Tên Ingame, RoleTag, TTV (chỉ cho BQT) */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar / Rank Badge */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isLeader
                            ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                            : isCoLeader
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/50'
                            : isQtv
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isLeader ? <CrownOutlined className="text-sm" /> : m.stt}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-base text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-500 transition">
                          {m.tenIngame}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RoleTag role={m.chucVu} />
                        </div>
                      </div>
                    </div>

                    {/* Tuyển thành viên: Toàn Clan */}
                    <div
                      onClick={() => canEditFund && handleOpenEdit(m, 'ttv', 'Số lượng TV tuyển được (TTV)', m.ttv)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${
                        canEditFund ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                      } bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/50 shadow-sm`}
                      title={canEditFund ? 'Nhấp để cập nhật số TV tuyển được' : 'Số lượng thành viên tuyển được'}
                    >
                      <UsergroupAddOutlined className="text-purple-500 dark:text-purple-400 text-xs" />
                      <span>{m.ttv || 0} TV</span>
                      {canEditFund && <EditOutlined className="text-[10px] opacity-70 ml-0.5" />}
                    </div>
                  </div>

                  {/* LƯỚI 12 THÁNG TRỰC QUAN (Y hệt hình ảnh yêu cầu) */}
                  <div className="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      <span>Đóng Quỹ 12 Tháng:</span>
                      {canEditFund && (
                        <span className="text-amber-500 dark:text-amber-400 text-xs font-normal">Nhấp ô để sửa</span>
                      )}
                    </div>

                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = i + 1;
                        const amount = m.months?.[monthNum] || 0;
                        const isPaid = amount > 0;

                        return (
                          <div
                            key={monthNum}
                            onClick={() => canEditFund && handleOpenEdit(m, `month_${monthNum}`, `Tháng ${monthNum}`, amount)}
                            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition text-center select-none ${
                              canEditFund ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                            } ${
                              isPaid
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                            title={`Tháng ${monthNum}: ${isPaid ? `${amount.toLocaleString('vi-VN')} ₫` : 'Chưa đóng'}`}
                          >
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-normal">T{monthNum}</span>
                            <span className={`text-xs font-mono font-bold mt-1 ${isPaid ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
                              {isPaid ? `${(amount / 1000).toFixed(0)}k` : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Khoản phụ: Ủng hộ & Phạt (nếu có hoặc click sửa) */}
                  {(m.ungHo > 0 || m.tienPhat > 0 || canEditFund) && (
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                      <div
                        onClick={() => canEditFund && handleOpenEdit(m, 'ungHo', 'Ủng hộ clan', m.ungHo)}
                        className={`flex items-center gap-1.5 ${canEditFund ? 'cursor-pointer hover:text-amber-500' : ''}`}
                        title="Ủng hộ clan (Click để sửa)"
                      >
                        <span>Ủng hộ:</span>
                        <strong className={`font-mono ${m.ungHo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {m.ungHo > 0 ? `${(m.ungHo / 1000).toFixed(0)}k` : '0'}
                        </strong>
                      </div>

                      <div
                        onClick={() => canEditFund && handleOpenEdit(m, 'tienPhat', 'Tiền phạt', m.tienPhat)}
                        className={`flex items-center gap-1.5 ${canEditFund ? 'cursor-pointer hover:text-rose-500' : ''}`}
                        title="Tiền phạt (Click để sửa)"
                      >
                        <span>Phạt:</span>
                        <strong className={`font-mono ${m.tienPhat > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {m.tienPhat > 0 ? `${(m.tienPhat / 1000).toFixed(0)}k` : '0'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DẠNG BẢNG (TABLE VIEW) - Ma trận cổ điển, cố định cột STT & Tên & Tổng */
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredMembers}
            rowKey="rowIndex"
            pagination={false}
            scroll={{ x: 1380 }}
            summary={() => (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row className="bg-amber-500/10 dark:bg-amber-950/40 font-bold border-t-2 border-amber-500">
                  <Table.Summary.Cell index={0} align="center">Σ</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>TỔNG CỘNG</Table.Summary.Cell>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Table.Summary.Cell key={i} index={i + 2} align="right">
                      <span className="font-mono text-xs">
                        {((totalRow.months?.[i + 1] || 0) / 1000).toFixed(0)}k
                      </span>
                    </Table.Summary.Cell>
                  ))}
                  <Table.Summary.Cell index={14} align="right">
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                      {((totalRow.ungHo || 0) / 1000).toFixed(0)}k
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={15} align="right">
                    <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                      {((totalRow.tienPhat || 0) / 1000).toFixed(0)}k
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={16} align="center">
                    <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-300">
                      {totalRow.ttv || 0} TV
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={17} align="right">
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {(totalRow.tongDongGop || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}

      {/* MODAL BÁO CÁO NHANH QUỸ THÁNG */}
      <Modal
        centered
        title={
          <div className="flex items-center gap-2">
            <NotificationOutlined className="text-amber-500 text-xl" />
            <span className="font-bold text-base text-slate-800 dark:text-slate-100">
              Báo Cáo Nhắc Quỹ Nhanh
            </span>
          </div>
        }
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        width={650}
        footer={[
          <Button key="close" onClick={() => setReportModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={copiedReport ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopyReportContent}
            className="bg-amber-500 hover:bg-amber-600 border-none font-bold min-w-[170px]"
          >
            {copiedReport ? 'Đã Sao Chép!' : 'Sao Chép Nội Dung'}
          </Button>
        ]}
        destroyOnClose
      >
        <div className="space-y-4 py-2">
          {/* Tuỳ chọn tháng báo cáo & Thống kê nhanh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                Tháng báo cáo:
              </span>
              <Select
                value={reportMonth}
                onChange={setReportMonth}
                className="w-32"
                options={Array.from({ length: 12 }, (_, i) => ({
                  label: `Tháng ${i + 1}`,
                  value: i + 1
                }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Tag color="error" className="font-bold py-0.5 px-2 text-xs m-0">
                Chưa đóng: {unpaidForReport.length} TV
              </Tag>
              <Tag color="success" className="font-bold py-0.5 px-2 text-xs m-0">
                Đã đóng: {members.length - unpaidForReport.length} TV
              </Tag>
            </div>
          </div>

          {/* Ô văn bản nội dung soạn sẵn */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nội dung soạn sẵn (BQT có thể chỉnh sửa trước khi sao chép):
              </span>
              <span className="text-[11px] text-amber-500 font-medium">
                Sẵn sàng dán vào Zalo / Messenger
              </span>
            </div>
            <Input.TextArea
              value={reportContent}
              onChange={e => setReportContent(e.target.value)}
              rows={13}
              className="font-sans text-xs leading-relaxed bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl"
            />
          </div>
        </div>
      </Modal>

      {/* Drawer / Bottom Sheet cập nhật quỹ hoặc TTV */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            {editingCell?.field === 'ttv' ? (
              <UsergroupAddOutlined className="text-purple-500 dark:text-purple-400 text-xl" />
            ) : (
              <DollarCircleOutlined className="text-amber-500 text-xl" />
            )}
            <div>
              <div className="font-bold text-base text-slate-800 dark:text-slate-100">
                {editingCell?.field === 'ttv' ? 'Ghi Nhận Số TV Tuyển Được' : 'Ghi Nhận Quỹ'}
                : <span className="text-amber-500 dark:text-amber-400">{editingCell?.member}</span>
              </div>
              <div className="text-xs text-slate-400 font-normal">{editingCell?.fieldLabel}</div>
            </div>
          </div>
        }
        placement="bottom"
        open={Boolean(editingCell)}
        onClose={() => setEditingCell(null)}
        height="auto"
        className="dark-drawer"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveFund} className="py-2 max-w-xl mx-auto">
          {editingCell?.field === 'ttv' ? (
            /* Form nhập số lượng TV tuyển được (TTV) */
            <>
              <div className="text-xs text-purple-600 dark:text-purple-300 mb-3 bg-purple-50 dark:bg-purple-950/60 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                ✨ Số lượng TTV sẽ được đồng bộ trực tiếp lên sheet <strong>Đua Top TTV {activeYear}</strong> và bảng xếp hạng thi đua của Clan!
              </div>

              <Form.Item
                name="month"
                label="Ghi nhận cho Tháng (Đua Top TTV)"
                rules={[{ required: true, message: 'Vui lòng chọn tháng' }]}
              >
                <Select
                  options={Array.from({ length: 12 }, (_, i) => ({
                    label: `Tháng ${i + 1}`,
                    value: i + 1
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="amount"
                label="Số lượng thành viên tuyển được (người)"
                rules={[{ required: true, message: 'Vui lòng nhập số lượng thành viên' }]}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  step={1}
                  precision={0}
                  inputMode="numeric"
                  size="large"
                  placeholder="Nhập số lượng thành viên tuyển được..."
                  addonAfter="thành viên"
                />
              </Form.Item>

              {/* Nút thao tác nhanh số lượng TV */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Button onClick={() => handleQuickSetTtv(1, true)} className="text-xs font-semibold">
                  + 1 TV
                </Button>
                <Button onClick={() => handleQuickSetTtv(2, true)} className="text-xs font-semibold">
                  + 2 TV
                </Button>
                <Button onClick={() => handleQuickSetTtv(5, true)} className="text-xs font-semibold">
                  + 5 TV
                </Button>
                <Button onClick={() => handleQuickSetTtv(0, false)} danger className="text-xs font-semibold">
                  Đặt về 0 TV
                </Button>
              </div>
            </>
          ) : (
            /* Form nhập số tiền (Tháng 1..12, Ủng hộ, Phạt) */
            <>
              <Form.Item
                name="amount"
                label="Số tiền (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  step={10000}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={value => value.replace(/\./g, '')}
                  inputMode="numeric"
                  size="large"
                />
              </Form.Item>

              {/* Nút thao tác nhanh số tiền */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Button onClick={() => handleQuickPayMoney(50000)} className="text-xs font-semibold">
                  + 50.000 ₫ (Tiêu chuẩn)
                </Button>
                <Button onClick={() => handleQuickPayMoney(100000)} className="text-xs font-semibold">
                  + 100.000 ₫
                </Button>
                <Button onClick={() => handleQuickPayMoney(0)} danger className="text-xs font-semibold">
                  Xoá (0 ₫)
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button onClick={() => setEditingCell(null)}>Huỷ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={recordFundMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold min-w-[120px]"
            >
              Lưu Cập Nhật
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
