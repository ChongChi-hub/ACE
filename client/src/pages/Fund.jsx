import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Drawer,
  Form,
  InputNumber,
  message,
  Grid,
  Collapse,
  Badge,
  Tooltip,
  Skeleton,
  Empty
} from 'antd';
import {
  DollarCircleOutlined,
  SearchOutlined,
  EditOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import { useIsMobile } from '../hooks/useIsMobile';
import * as XLSX from 'xlsx';

export function Fund() {
  const { user, activeYear } = useAuth();
  const isMobile = useIsMobile();

  const [searchText, setSearchText] = useState('');
  const [unpaidMonthFilter, setUnpaidMonthFilter] = useState('ALL');

  // Edit Fund Drawer / Modal
  const [editingCell, setEditingCell] = useState(null); // { member, field, fieldLabel, currentAmount }
  const [form] = Form.useForm();

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

  // Mutation cập nhật quỹ
  const recordFundMutation = useMutation({
    mutationFn: ({ rowIndex, field, amount }) =>
      api.post(`/fund/record?year=${activeYear}`, { rowIndex, field, amount }),
    onSuccess: (res) => {
      message.success(res.data.message || 'Ghi nhận quỹ thành công!');
      queryClient.invalidateQueries({ queryKey: ['members', activeYear] });
      setEditingCell(null);
      form.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Không thể ghi nhận quỹ!');
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
    form.setFieldsValue({ amount: currentAmount || 0 });
  };

  const handleSaveFund = (values) => {
    if (!editingCell) return;
    recordFundMutation.mutate({
      rowIndex: editingCell.rowIndex,
      field: editingCell.field,
      amount: values.amount || 0
    });
  };

  // Đóng nhanh 50.000 ₫
  const handleQuickPay = (amount = 50000) => {
    form.setFieldsValue({ amount });
  };

  // Xuất file Excel
  const handleExportExcel = () => {
    const exportData = members.map(m => {
      const row = {
        'STT': m.stt,
        'Tên Ingame': m.tenIngame,
        'ID Game': m.gameId,
        'Chức vụ': m.chucVu,
      };
      for (let i = 1; i <= 12; i++) {
        row[`Tháng ${i}`] = m.months?.[i] || 0;
      }
      row['Ủng hộ clan'] = m.ungHo || 0;
      row['Tiền phạt'] = m.tienPhat || 0;
      row['TTV'] = m.ttv || 0;
      row['Tổng đóng góp'] = m.tongDongGop || 0;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Quỹ ${activeYear}`);
    XLSX.writeFile(workbook, `CLAN_ACE_SUN_QUY_${activeYear}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

  // Desktop Columns (Ma trận quỹ)
  const columns = [
    {
      title: 'STT',
      dataIndex: 'stt',
      key: 'stt',
      width: 55,
      fixed: 'left',
      align: 'center',
    },
    {
      title: 'Tên Ingame',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      width: 140,
      fixed: 'left',
      render: (text) => (
        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate block">
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
        width: 85,
        align: 'right',
        render: (_, record) => {
          const val = record.months?.[monthNum] || 0;
          const isPaid = val > 0;

          return (
            <div
              onClick={() => canEditFund && handleOpenEdit(record, `month_${monthNum}`, `Tháng ${monthNum}`, val)}
              className={`p-1.5 rounded transition text-xs font-mono select-none ${
                canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : 'cursor-default'
              } ${
                isPaid
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40'
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
      width: 90,
      align: 'right',
      render: (val, record) => (
        <div
          onClick={() => canEditFund && handleOpenEdit(record, 'ungHo', 'Ủng hộ clan', val)}
          className={`p-1.5 rounded text-xs font-mono font-semibold ${
            canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : ''
          } ${val > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
        >
          {val > 0 ? `${(val / 1000).toFixed(0)}k` : '-'}
        </div>
      ),
    },
    {
      title: 'Phạt',
      dataIndex: 'tienPhat',
      key: 'tienPhat',
      width: 85,
      align: 'right',
      render: (val, record) => (
        <div
          onClick={() => canEditFund && handleOpenEdit(record, 'tienPhat', 'Tiền phạt', val)}
          className={`p-1.5 rounded text-xs font-mono font-semibold ${
            canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : ''
          } ${val > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}
        >
          {val > 0 ? `${(val / 1000).toFixed(0)}k` : '-'}
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="TTV: Tiền tài trợ riêng, không tính vào Tổng đóng góp">
          <span>TTV <InfoCircleOutlined className="text-xs" /></span>
        </Tooltip>
      ),
      dataIndex: 'ttv',
      key: 'ttv',
      width: 85,
      align: 'right',
      render: (val, record) => (
        <div
          onClick={() => canEditFund && handleOpenEdit(record, 'ttv', 'TTV (Không tính vào Tổng)', val)}
          className={`p-1.5 rounded text-xs font-mono ${
            canEditFund ? 'cursor-pointer hover:ring-2 hover:ring-amber-500' : ''
          } ${val > 0 ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-semibold' : 'text-slate-400'}`}
        >
          {val > 0 ? `${(val / 1000).toFixed(0)}k` : '-'}
        </div>
      ),
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tongDongGop',
      key: 'tongDongGop',
      width: 120,
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
      {/* 1. Header Card công cụ & Trạng thái quyền */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {canEditFund ? (
              <Tag color="success" icon={<EditOutlined />} className="font-bold py-1 px-2.5 text-xs m-0">
                Bạn có quyền ghi quỹ
              </Tag>
            ) : (
              <Tag color="default" icon={<LockOutlined />} className="font-medium py-1 px-2.5 text-xs m-0">
                Chế độ chỉ xem
              </Tag>
            )}

            <span className="text-xs text-slate-400 hidden sm:inline">
              (Năm: {activeYear} • Nhấp vào ô để cập nhật số tiền)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm ingame, ID..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="w-full sm:w-44"
            />

            <Select
              value={unpaidMonthFilter}
              onChange={setUnpaidMonthFilter}
              className="w-full sm:w-44"
              options={[
                { label: 'Tất cả thành viên', value: 'ALL' },
                ...Array.from({ length: 12 }, (_, i) => ({
                  label: `Chưa đóng Tháng ${i + 1}`,
                  value: String(i + 1)
                }))
              ]}
            />

            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              className="border-slate-300 dark:border-slate-700"
            >
              Xuất Excel
            </Button>

            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
            />
          </div>
        </div>
      </Card>

      {/* Ghi chú về TTV */}
      <div className="text-xs text-slate-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
        <InfoCircleOutlined className="text-amber-500 flex-shrink-0" />
        <span>
          <strong>Lưu ý:</strong> Cột <strong>TTV</strong> được quản lý riêng và <strong>không tính vào cột Tổng đóng góp</strong> theo công thức Google Sheets.
        </span>
      </div>

      {/* 2. Dữ liệu Quỹ */}
      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>
      ) : isMobile ? (
        /* Mobile: Accordion Collapse List với lưới Chip tròn 12 tháng */
        <div className="space-y-3">
          {filteredMembers.length === 0 ? (
            <Card><Empty description="Không có dữ liệu phù hợp" /></Card>
          ) : (
            <Collapse
              accordion
              className="bg-transparent border-none space-y-2"
              items={filteredMembers.map((m) => {
                const paidMonthsCount = Object.values(m.months || {}).filter(v => v > 0).length;

                return {
                  key: String(m.rowIndex),
                  label: (
                    <div className="flex items-center justify-between pr-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                          {m.stt}
                        </span>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {m.tenIngame}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          count={`${paidMonthsCount}/12 T`}
                          style={{ backgroundColor: paidMonthsCount === 12 ? '#10b981' : '#f59e0b' }}
                        />
                        <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                          {(m.tongDongGop || 0).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    </div>
                  ),
                  children: (
                    <div className="space-y-4 pt-1 pb-2">
                      {/* Lưới 12 chip tháng tròn */}
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-2">Đóng Quỹ 12 Tháng:</div>
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthNum = i + 1;
                            const amount = m.months?.[monthNum] || 0;
                            const isPaid = amount > 0;

                            return (
                              <button
                                key={monthNum}
                                type="button"
                                disabled={!canEditFund}
                                onClick={() => handleOpenEdit(m, `month_${monthNum}`, `Tháng ${monthNum}`, amount)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition cursor-pointer ${
                                  isPaid
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                                } ${canEditFund ? 'active:scale-95' : 'cursor-default'}`}
                              >
                                <span className="text-[11px] font-bold">Tháng {monthNum}</span>
                                <span className="text-xs font-mono font-semibold mt-0.5">
                                  {isPaid ? `${(amount / 1000).toFixed(0)}k` : '-'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Các khoản phụ: Ủng hộ, Phạt, TTV */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                        <div
                          onClick={() => canEditFund && handleOpenEdit(m, 'ungHo', 'Ủng hộ clan', m.ungHo)}
                          className={`p-2 rounded-lg border ${canEditFund ? 'cursor-pointer active:scale-95' : ''} bg-amber-500/10 border-amber-500/20`}
                        >
                          <span className="text-[10px] text-slate-400 block">Ủng hộ clan</span>
                          <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                            {(m.ungHo || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>

                        <div
                          onClick={() => canEditFund && handleOpenEdit(m, 'tienPhat', 'Tiền phạt', m.tienPhat)}
                          className={`p-2 rounded-lg border ${canEditFund ? 'cursor-pointer active:scale-95' : ''} bg-rose-500/10 border-rose-500/20`}
                        >
                          <span className="text-[10px] text-slate-400 block">Tiền phạt</span>
                          <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                            {(m.tienPhat || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>

                        <div
                          onClick={() => canEditFund && handleOpenEdit(m, 'ttv', 'TTV (Không tính vào Tổng)', m.ttv)}
                          className={`p-2 rounded-lg border ${canEditFund ? 'cursor-pointer active:scale-95' : ''} bg-purple-500/10 border-purple-500/20`}
                        >
                          <span className="text-[10px] text-slate-400 block">TTV (*)</span>
                          <span className="font-bold text-xs text-purple-600 dark:text-purple-300">
                            {(m.ttv || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                };
              })}
            />
          )}
        </div>
      ) : (
        /* Desktop: Bảng Ma Trận Quỹ Cố Định Cột */
        <Card className="shadow-sm border-slate-200 dark:border-slate-800" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredMembers}
            rowKey="rowIndex"
            pagination={false}
            scroll={{ x: 1300 }}
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
                  <Table.Summary.Cell index={16} align="right">
                    <span className="font-mono text-xs text-purple-600 dark:text-purple-300">
                      {((totalRow.ttv || 0) / 1000).toFixed(0)}k
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

      {/* Drawer / Bottom Sheet cập nhật quỹ */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <DollarCircleOutlined className="text-amber-500 text-lg" />
            <div>
              <div className="font-bold text-sm">Ghi Nhận Quỹ: {editingCell?.member}</div>
              <div className="text-xs text-slate-400 font-normal">{editingCell?.fieldLabel}</div>
            </div>
          </div>
        }
        placement="bottom"
        open={Boolean(editingCell)}
        onClose={() => setEditingCell(null)}
        height="auto"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveFund} className="py-2">
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

          {/* Nút thao tác nhanh */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button onClick={() => handleQuickPay(50000)} className="text-xs font-semibold">
              + 50.000 ₫ (Tiêu chuẩn)
            </Button>
            <Button onClick={() => handleQuickPay(100000)} className="text-xs font-semibold">
              + 100.000 ₫
            </Button>
            <Button onClick={() => handleQuickPay(0)} danger className="text-xs font-semibold">
              Xoá (0 ₫)
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditingCell(null)}>Huỷ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={recordFundMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 border-none font-bold min-w-[100px]"
            >
              Lưu Quỹ
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
