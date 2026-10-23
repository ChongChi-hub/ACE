import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Select,
  Button,
  Table,
  Tag,
  Modal,
  Drawer,
  InputNumber,
  message,
  Tooltip,
  Segmented,
  Avatar,
  Badge,
  Spin,
  Alert
} from 'antd';
import {
  TrophyOutlined,
  CrownFilled,
  FireFilled,
  NotificationOutlined,
  CopyOutlined,
  CheckOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
  StarFilled,
  RiseOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import { useIsMobile } from '../hooks/useIsMobile';

export function TtvRace() {
  const { user, activeYear, setActiveYear, availableYears } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Mặc định hiển thị TẤT CẢ thành viên (toàn Clan đua top)
  const currentMonthNum = new Date().getMonth() + 1;
  const [selectedPeriod, setSelectedPeriod] = useState(String(currentMonthNum)); // '1'..'12' hoặc 'YEAR'
  const [onlyBqt, setOnlyBqt] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal / Drawer cập nhật điểm TTV
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null); // { tenIngame, month, currentVal }
  const [customValue, setCustomValue] = useState(0);

  // Quyền cập nhật TTV: Leader hoặc người có quyền ghi quỹ
  const canEdit = user?.role === 'Leader' || user?.canEditFund === true;

  // Lấy dữ liệu Đua Top TTV
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ttv-race', activeYear],
    queryFn: async () => {
      const res = await api.get(`/ttv-race?year=${activeYear}`);
      return res.data.data;
    }
  });

  const membersRaw = data?.members || [];
  const monthlyTotals = data?.monthlyTotals || {};
  const totalYearSum = data?.totalYearSum || 0;

  // Mutation cập nhật điểm TTV
  const recordMutation = useMutation({
    mutationFn: async ({ tenIngame, month, value }) => {
      const res = await api.post(`/ttv-race/record?year=${activeYear}`, {
        tenIngame,
        month,
        value
      });
      return res.data;
    },
    onSuccess: (res) => {
      message.success(res.message || 'Cập nhật điểm TTV thành công!');
      queryClient.invalidateQueries({ queryKey: ['ttv-race', activeYear] });
      setEditDrawerOpen(false);
      setEditingTarget(null);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật TTV!');
    }
  });

  // Lọc danh sách và tính điểm theo kỳ chọn
  const rankedList = useMemo(() => {
    let list = membersRaw;
    if (onlyBqt) {
      list = list.filter((m) => m.isBQT);
    }

    return list
      .map((m) => {
        let score = 0;
        if (selectedPeriod === 'YEAR') {
          score = m.tongNam || 0;
        } else {
          const mNum = parseInt(selectedPeriod, 10);
          score = m.months?.[mNum] || 0;
        }
        return {
          ...m,
          currentScore: score
        };
      })
      .sort((a, b) => b.currentScore - a.currentScore);
  }, [membersRaw, onlyBqt, selectedPeriod]);

  // Top 3 người dẫn đầu
  const top1 = rankedList[0];
  const top2 = rankedList[1];
  const top3 = rankedList[2];

  // Mở Drawer sửa điểm
  const handleOpenEdit = (record, monthNum) => {
    if (!canEdit) return;
    const currentVal = record.months?.[monthNum] || 0;
    setEditingTarget({
      tenIngame: record.tenIngame,
      chucVu: record.chucVu,
      month: monthNum,
      currentVal: currentVal
    });
    setCustomValue(currentVal);
    setEditDrawerOpen(true);
  };

  const handleQuickAdd = (delta) => {
    if (!editingTarget) return;
    const newVal = Math.max(0, (editingTarget.currentVal || 0) + delta);
    recordMutation.mutate({
      tenIngame: editingTarget.tenIngame,
      month: editingTarget.month,
      value: newVal
    });
  };

  const handleSaveCustom = () => {
    if (!editingTarget) return;
    recordMutation.mutate({
      tenIngame: editingTarget.tenIngame,
      month: editingTarget.month,
      value: customValue
    });
  };

  // Mẫu nội dung Báo Cáo Trao Thưởng
  const reportText = useMemo(() => {
    const periodName = selectedPeriod === 'YEAR' ? `NĂM ${activeYear}` : `THÁNG ${selectedPeriod}/${activeYear}`;
    const totalNewInPeriod = selectedPeriod === 'YEAR'
      ? totalYearSum
      : (monthlyTotals[parseInt(selectedPeriod, 10)] || 0);

    let text = `🏆 BẢNG VINH DANH ĐUA TOP TTV ${periodName} - CLAN 『ACE SUN』 🏆\n\n`;

    if (top1 && top1.currentScore > 0) {
      text += `🥇 TOP 1 (Quán Quân): ${top1.tenIngame} [${top1.chucVu}] - Tuyển được: ${top1.currentScore} Thành viên 🎖️\n`;
    } else {
      text += `🥇 TOP 1: Chưa có dữ liệu\n`;
    }

    if (top2 && top2.currentScore > 0) {
      text += `🥈 TOP 2 (Á Quân 1): ${top2.tenIngame} [${top2.chucVu}] - Tuyển được: ${top2.currentScore} Thành viên\n`;
    }

    if (top3 && top3.currentScore > 0) {
      text += `🥉 TOP 3 (Á Quân 2): ${top3.tenIngame} [${top3.chucVu}] - Tuyển được: ${top3.currentScore} Thành viên\n`;
    }

    text += `\n--------------------------------------------\n`;
    text += `📊 Tổng số thành viên mới tuyển được: ${totalNewInPeriod} TV\n`;
    text += `👏 Xin chúc mừng các cá nhân xuất sắc nhận thưởng thi đua!\n`;
    text += `🔥 Clan ACE SUN chân thành cảm ơn sự đóng góp nhiệt huyết của toàn thể anh em!`;

    return text;
  }, [selectedPeriod, activeYear, top1, top2, top3, monthlyTotals, totalYearSum]);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      message.success('Đã sao chép nội dung báo cáo trao thưởng vào bộ nhớ tạm!');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      message.error('Không thể sao chép tự động, vui lòng chọn và copy thủ công!');
    }
  };

  // Cột bảng desktop
  const columns = [
    {
      title: 'Hạng',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (_, __, index) => {
        if (index === 0) {
          return <span className="text-xl" title="Hạng 1">🥇</span>;
        }
        if (index === 1) {
          return <span className="text-xl" title="Hạng 2">🥈</span>;
        }
        if (index === 2) {
          return <span className="text-xl" title="Hạng 3">🥉</span>;
        }
        return <span className="font-mono font-bold text-slate-500">#{index + 1}</span>;
      }
    },
    {
      title: 'Tên Ingame',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      render: (name, r) => (
        <div className="flex items-center gap-2">
          <Avatar
            size="small"
            style={{
              backgroundColor: r.chucVu === 'Leader' ? '#d97706' : r.chucVu === 'Co-Leader' ? '#2563eb' : '#06b6d4'
            }}
          >
            {name?.[0] || 'A'}
          </Avatar>
          <span className="font-bold text-slate-800 dark:text-slate-100">{name}</span>
        </div>
      )
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chucVu',
      key: 'chucVu',
      width: 120,
      render: (role) => <RoleTag role={role} />
    },
    {
      title: (
        <span className="text-amber-500 font-bold">
          {selectedPeriod === 'YEAR' ? `Điểm cả năm` : `Điểm Tháng ${selectedPeriod}`}
        </span>
      ),
      dataIndex: 'currentScore',
      key: 'currentScore',
      align: 'center',
      width: 130,
      render: (score, record) => (
        <div className="inline-flex items-center gap-1.5 font-mono font-black text-base text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <span>{score}</span>
          <span className="text-xs font-normal">TV</span>
        </div>
      )
    },
    // Chi tiết 12 tháng
    ...Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const isSelected = selectedPeriod === String(mNum);
      return {
        title: `T${mNum}`,
        key: `m_${mNum}`,
        width: 65,
        align: 'center',
        render: (_, record) => {
          const val = record.months?.[mNum] || 0;
          return (
            <div
              onClick={() => canEdit && handleOpenEdit(record, mNum)}
              className={`py-1 px-1.5 rounded transition text-xs font-mono font-semibold ${
                canEdit ? 'cursor-pointer hover:ring-2 hover:ring-amber-500 hover:scale-105' : ''
              } ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : val > 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  : 'text-slate-400 dark:text-slate-600'
              }`}
              title={canEdit ? `Bấm để cập nhật TTV Tháng ${mNum}` : `TTV Tháng ${mNum}`}
            >
              {val > 0 ? val : '-'}
            </div>
          );
        }
      };
    }),
    {
      title: 'Tổng Năm',
      dataIndex: 'tongNam',
      key: 'tongNam',
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (total) => (
        <span className="font-mono font-black text-sm text-emerald-500">
          {total || 0} TV
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800 p-5 sm:p-7 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <TrophyOutlined className="text-amber-400" />
              Thi Đua Tuyển Quân Toàn Clan
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-wide text-white m-0 flex items-center gap-2">
              Bảng Đua Top TTV {activeYear}
            </h1>
            <p className="text-amber-100/90 text-xs sm:text-sm mt-1 max-w-xl m-0">
              Vinh danh những thành viên tích cực tuyển quân phát triển Clan 『ACE SUN』. Ai dẫn đầu mỗi tháng đều có phần thưởng nóng!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="primary"
              icon={<NotificationOutlined />}
              onClick={() => setReportModalOpen(true)}
              className="bg-white text-amber-800 hover:!bg-amber-50 hover:!text-amber-900 border-none font-bold shadow-lg"
            >
              Báo Cáo Trao Thưởng
            </Button>

            <Tooltip title="Tải lại dữ liệu từ Google Sheet">
              <Button
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => refetch()}
                className="bg-black/30 hover:!bg-black/50 text-white border-white/20"
              />
            </Tooltip>
          </div>
        </div>

        {/* Trang trí nền */}
        <div className="absolute -right-8 -bottom-10 opacity-15 pointer-events-none text-9xl">
          <TrophyOutlined />
        </div>
      </div>

      {/* 2. Bộ lọc kỳ đua top (Theo Tháng hoặc Cả Năm) */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Xem Kỳ:</span>
            <Select
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              className="w-44"
              options={[
                ...Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: `Tháng ${i + 1}${i + 1 === currentMonthNum ? ' (Hiện tại)' : ''}`
                })),
                { value: 'YEAR', label: `Tổng Cả Năm ${activeYear}` }
              ]}
            />

            <Select
              value={activeYear}
              onChange={setActiveYear}
              className="w-24"
              options={availableYears.map((y) => ({ value: y, label: `Năm ${y}` }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <Segmented
              value={onlyBqt ? 'bqt' : 'all'}
              onChange={(val) => setOnlyBqt(val === 'bqt')}
              options={[
                { label: 'Tất cả thành viên (Toàn Clan)', value: 'all' },
                { label: 'Chỉ Ban Quản Trị (7 người)', value: 'bqt' }
              ]}
              className="bg-slate-100 dark:bg-slate-800 p-0.5"
            />
          </div>
        </div>
      </Card>

      {/* 3. BỤC VINH DANH TOP 3 (PODIUM) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4 pb-2">
        {/* Á QUÂN 1 (#2) */}
        <div className="order-2 md:order-1">
          <Card className="text-center shadow-lg border-slate-300 dark:border-slate-700 bg-gradient-to-t from-slate-200/50 dark:from-slate-800/80 to-transparent relative rounded-2xl overflow-hidden hover:scale-[1.02] transition">
            <div className="absolute top-3 left-3">
              <span className="text-2xl">🥈</span>
            </div>
            <div className="py-2">
              <Avatar
                size={64}
                className="bg-slate-400 border-4 border-slate-300 dark:border-slate-600 shadow-md mb-2 font-bold text-xl"
              >
                {top2?.tenIngame?.[0] || '2'}
              </Avatar>
              <div className="font-bold text-base truncate px-2 text-slate-800 dark:text-slate-100">
                {top2?.tenIngame || '---'}
              </div>
              <div className="text-xs mb-3">
                <RoleTag role={top2?.chucVu} />
              </div>
              <div className="inline-flex items-center gap-1 font-mono font-black text-xl text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-700/60 px-4 py-1.5 rounded-full">
                <span>{top2?.currentScore || 0}</span>
                <span className="text-xs font-normal">TV</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-semibold">Á Quân 1</div>
            </div>
          </Card>
        </div>

        {/* QUÁN QUÂN (#1) - NỔI BẬT NHẤT */}
        <div className="order-1 md:order-2">
          <Card className="text-center shadow-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-t from-amber-500/20 via-slate-900/40 to-transparent relative rounded-2xl overflow-hidden hover:scale-[1.03] transition relative">
            <div className="absolute top-2 left-0 right-0 flex justify-center">
              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md">
                <CrownFilled /> Quán Quân Đang Dẫn Đầu
              </span>
            </div>
            <div className="pt-7 pb-3">
              <div className="relative inline-block mb-2">
                <Avatar
                  size={84}
                  className="bg-gradient-to-br from-amber-400 to-amber-600 border-4 border-amber-300 shadow-xl font-black text-3xl text-slate-950"
                >
                  {top1?.tenIngame?.[0] || '1'}
                </Avatar>
                <div className="absolute -top-3 -right-2 text-2xl animate-bounce">
                  👑
                </div>
              </div>
              <div className="font-extrabold text-lg truncate px-2 text-amber-500 dark:text-amber-400">
                {top1?.tenIngame || '---'}
              </div>
              <div className="text-xs mb-3">
                <RoleTag role={top1?.chucVu} />
              </div>
              <div className="inline-flex items-center gap-1.5 font-mono font-black text-2xl text-amber-500 bg-amber-500/20 px-5 py-2 rounded-full border border-amber-500/40 shadow-inner">
                <FireFilled className="text-amber-500" />
                <span>{top1?.currentScore || 0}</span>
                <span className="text-xs font-normal">TV Tuyển</span>
              </div>
              <div className="text-xs text-amber-500/80 mt-2 font-bold">
                {selectedPeriod === 'YEAR' ? 'Đứng đầu cả năm' : `Đứng đầu Tháng ${selectedPeriod}`}
              </div>
            </div>
          </Card>
        </div>

        {/* Á QUÂN 2 (#3) */}
        <div className="order-3">
          <Card className="text-center shadow-lg border-amber-800/40 dark:border-amber-900/60 bg-gradient-to-t from-amber-900/20 dark:from-amber-950/40 to-transparent relative rounded-2xl overflow-hidden hover:scale-[1.02] transition">
            <div className="absolute top-3 left-3">
              <span className="text-2xl">🥉</span>
            </div>
            <div className="py-2">
              <Avatar
                size={64}
                className="bg-amber-800 border-4 border-amber-700 shadow-md mb-2 font-bold text-xl text-amber-200"
              >
                {top3?.tenIngame?.[0] || '3'}
              </Avatar>
              <div className="font-bold text-base truncate px-2 text-slate-800 dark:text-slate-100">
                {top3?.tenIngame || '---'}
              </div>
              <div className="text-xs mb-3">
                <RoleTag role={top3?.chucVu} />
              </div>
              <div className="inline-flex items-center gap-1 font-mono font-black text-xl text-amber-700 dark:text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full">
                <span>{top3?.currentScore || 0}</span>
                <span className="text-xs font-normal">TV</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-semibold">Á Quân 2</div>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. BẢNG XẾP HẠNG CHI TIẾT */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <RiseOutlined className="text-amber-500" />
            <span className="font-heading font-bold text-base">
              Bảng Thành Tích Chi Tiết 12 Tháng (Năm {activeYear})
            </span>
          </div>
        }
        className="shadow-sm border-slate-200 dark:border-slate-800"
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={rankedList}
          rowKey="tenIngame"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 1000 }}
          rowClassName={(record, index) =>
            index === 0
              ? 'bg-amber-500/5 font-semibold'
              : ''
          }
        />
      </Card>

      {/* MODAL BÁO CÁO NHANH TRAO THƯỞNG */}
      <Modal
        centered
        title={
          <div className="flex items-center gap-2">
            <TrophyOutlined className="text-amber-500 text-xl" />
            <span className="font-bold text-base text-slate-800 dark:text-slate-100">
              Báo Cáo Trao Thưởng Đua Top TTV
            </span>
          </div>
        }
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setReportModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopyReport}
            className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
          >
            {copied ? 'Đã Sao Chép!' : 'Sao Chép Báo Cáo (1-Click)'}
          </Button>
        ]}
      >
        <div className="space-y-3 py-2">
          <Alert
            message="Nội dung đã được tạo tự động"
            description="Bạn chỉ cần nhấn 'Sao Chép' và dán thẳng vào nhóm chat Zalo / Messenger của Clan để thông báo kết quả thi đua!"
            type="success"
            showIcon
          />

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
            {reportText}
          </div>
        </div>
      </Modal>

      {/* DRAWER CẬP NHẬT ĐIỂM TTV */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <EditOutlined className="text-amber-500" />
            <span>Ghi Nhận Số TV Tuyển Được</span>
          </div>
        }
        placement={isMobile ? 'bottom' : 'right'}
        height={isMobile ? 380 : undefined}
        width={380}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
      >
        {editingTarget && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
              <div className="text-xs text-slate-400">Thành viên Clan:</div>
              <div className="font-bold text-base text-slate-800 dark:text-slate-100 mt-0.5">
                {editingTarget.tenIngame}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <RoleTag role={editingTarget.chucVu} />
                <span className="text-xs font-semibold text-amber-500">
                  Tháng {editingTarget.month}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Cộng Nhanh:</div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => handleQuickAdd(1)}
                  loading={recordMutation.isPending}
                  className="font-bold"
                >
                  +1 TV
                </Button>
                <Button
                  onClick={() => handleQuickAdd(2)}
                  loading={recordMutation.isPending}
                  className="font-bold"
                >
                  +2 TV
                </Button>
                <Button
                  onClick={() => handleQuickAdd(5)}
                  loading={recordMutation.isPending}
                  className="font-bold"
                >
                  +5 TV
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Hoặc Nhập Số Trực Tiếp:</div>
              <div className="flex gap-2">
                <InputNumber
                  min={0}
                  max={999}
                  value={customValue}
                  onChange={(val) => setCustomValue(val || 0)}
                  className="w-full text-base font-bold"
                />
                <Button
                  type="primary"
                  onClick={handleSaveCustom}
                  loading={recordMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 border-none font-bold"
                >
                  Lưu
                </Button>
              </div>
            </div>

            <Button
              danger
              block
              onClick={() => {
                recordMutation.mutate({
                  tenIngame: editingTarget.tenIngame,
                  month: editingTarget.month,
                  value: 0
                });
              }}
              loading={recordMutation.isPending}
              className="text-xs"
            >
              Đặt Về 0 TV (Xoá điểm tháng này)
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
