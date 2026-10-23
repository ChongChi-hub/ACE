import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Table,
  Tag,
  Skeleton,
  Empty,
  Typography,
  Progress,
  Button
} from 'antd';
import {
  TeamOutlined,
  CrownOutlined,
  UserOutlined,
  DollarCircleOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RoleTag } from '../components/RoleTag';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export function Dashboard() {
  const { activeYear, setAvailableYears } = useAuth();
  const currentMonthNum = dayjs().month() + 1; // 1-12
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum <= 12 ? currentMonthNum : 10);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['members', activeYear],
    queryFn: async () => {
      const res = await api.get(`/members?year=${activeYear}`);
      if (res.data.data?.availableYears) {
        setAvailableYears(res.data.data.availableYears);
      }
      return res.data.data;
    },
    refetchInterval: 60000 // Tự refetch mỗi 60 giây
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map(i => (
            <Col xs={12} sm={12} lg={6} key={i}>
              <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>
            </Col>
          ))}
        </Row>
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="text-center py-12">
        <ExclamationCircleOutlined className="text-4xl text-rose-500 mb-3" />
        <Title level={4}>Không thể tải dữ liệu Dashboard</Title>
        <Text type="secondary">{error?.message || 'Lỗi kết nối'}</Text>
        <div className="mt-4">
          <Button type="primary" onClick={() => refetch()}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const { stats, members = [], totalRow = {} } = data || {};

  // Dữ liệu biểu đồ 12 tháng
  const chartData = [];
  for (let m = 1; m <= 12; m++) {
    chartData.push({
      thang: `T${m}`,
      tenThang: `Tháng ${m}`,
      tongTien: totalRow.months?.[m] || 0
    });
  }

  // Danh sách chưa đóng tháng được chọn (số tiền = 0)
  const unpaidMembers = members.filter(m => (m.months?.[selectedMonth] || 0) === 0);
  const paidCount = members.length - unpaidMembers.length;
  const completionRate = members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0;

  // Top 5 thành viên đóng góp nhiều nhất
  const topMembers = [...members]
    .sort((a, b) => (b.tongDongGop || 0) - (a.tongDongGop || 0))
    .slice(0, 5);

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `Tháng ${i + 1}`
  }));

  const unpaidColumns = [
    {
      title: 'STT',
      dataIndex: 'stt',
      key: 'stt',
      width: 60,
    },
    {
      title: 'Tên Ingame',
      dataIndex: 'tenIngame',
      key: 'tenIngame',
      render: (text, record) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-100">{text}</span>
          <div className="text-xs text-slate-400">ID: {record.gameId || '---'}</div>
        </div>
      ),
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chucVu',
      key: 'chucVu',
      render: role => <RoleTag role={role} />,
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
            className="text-blue-500 hover:underline text-xs"
          >
            {name}
          </a>
        ) : (
          <span className="text-xs text-slate-400">{name}</span>
        ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'right',
      render: () => <Tag color="error">Chưa đóng</Tag>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Bốn thẻ thống kê (2 cột trên mobile, 4 trên desktop) */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={12} lg={6}>
          <Card className="hover:shadow-md transition border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-500/10 to-transparent">
            <Statistic
              title={<span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tổng Thành Viên</span>}
              value={stats?.totalMembers || 0}
              prefix={<TeamOutlined className="text-amber-500 mr-1" />}
              valueStyle={{ fontWeight: 800, color: '#f59e0b' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card className="hover:shadow-md transition border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-500/10 to-transparent">
            <Statistic
              title={<span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ban Quản Trị</span>}
              value={stats?.banQuanTri || 0}
              prefix={<CrownOutlined className="text-blue-500 mr-1" />}
              valueStyle={{ fontWeight: 800, color: '#3b82f6' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card className="hover:shadow-md transition border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-500/10 to-transparent">
            <Statistic
              title={<span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Thành Viên Chính Thức</span>}
              value={stats?.thanhVienChinhThuc || 0}
              prefix={<UserOutlined className="text-emerald-500 mr-1" />}
              valueStyle={{ fontWeight: 800, color: '#10b981' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={6}>
          <Card className="hover:shadow-md transition border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-500/10 to-transparent">
            <Statistic
              title={<span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tổng Thu Quỹ Clan</span>}
              value={stats?.tongThuQuy || 0}
              formatter={val => `${val.toLocaleString('vi-VN')} ₫`}
              prefix={<DollarCircleOutlined className="text-rose-500 mr-1" />}
              valueStyle={{ fontWeight: 800, color: '#f43f5e' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. Biểu đồ thu quỹ theo 12 tháng */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <DollarCircleOutlined className="text-amber-500" />
            <span className="font-heading font-bold text-base">Biểu Đồ Thu Quỹ Theo Tháng (Năm {activeYear})</span>
          </div>
        }
        className="shadow-sm border-slate-200 dark:border-slate-800"
      >
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="thang" stroke="#888888" fontSize={12} />
              <YAxis
                stroke="#888888"
                fontSize={11}
                tickFormatter={val => `${val / 1000}k`}
              />
              <Tooltip
                formatter={(val) => [`${val.toLocaleString('vi-VN')} ₫`, 'Thu quỹ']}
                labelFormatter={(label) => `Tháng ${label.replace('T', '')}`}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="tongTien" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3. Tiến độ đóng quỹ & Thành viên chưa đóng tháng này */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-heading font-bold text-base">
                  Chưa Đóng Quỹ Tháng {selectedMonth} ({unpaidMembers.length} thành viên)
                </span>
                <Select
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={monthOptions}
                  className="w-32"
                />
              </div>
            }
            className="shadow-sm border-slate-200 dark:border-slate-800 h-full"
          >
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Tỷ lệ hoàn thành ({paidCount}/{members.length})</span>
                <span className="font-bold">{completionRate}%</span>
              </div>
              <Progress percent={completionRate} strokeColor="#f59e0b" showInfo={false} />
            </div>

            {unpaidMembers.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircleOutlined className="text-3xl text-emerald-500 mb-2" />
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  Tất cả thành viên đã hoàn thành quỹ Tháng {selectedMonth}!
                </div>
              </div>
            ) : (
              <Table
                dataSource={unpaidMembers}
                columns={unpaidColumns}
                rowKey="rowIndex"
                pagination={{ pageSize: 5, size: 'small' }}
                size="small"
                scroll={{ x: 400 }}
              />
            )}
          </Card>
        </Col>

        {/* 4. Top Đóng Góp */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <TrophyOutlined className="text-amber-500" />
                <span className="font-heading font-bold text-base">Top Đóng Góp Quỹ</span>
              </div>
            }
            className="shadow-sm border-slate-200 dark:border-slate-800 h-full"
          >
            <div className="space-y-3">
              {topMembers.map((m, idx) => (
                <div
                  key={m.rowIndex}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-500 text-white'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-800'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                        {m.tenIngame}
                      </div>
                      <RoleTag role={m.chucVu} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                      {(m.tongDongGop || 0).toLocaleString('vi-VN')} ₫
                    </div>
                    <div className="text-[10px] text-slate-400">Tổng cộng</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
