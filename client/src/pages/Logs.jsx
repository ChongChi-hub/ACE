import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Input, Select, Tag, Button, Skeleton, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../api/client';
import dayjs from 'dayjs';
import { useIsMobile } from '../hooks/useIsMobile';

export function Logs() {
  const isMobile = useIsMobile();

  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const res = await api.get('/logs?limit=300');
      return res.data.data;
    }
  });

  const actionTagColors = {
    'GHI_QUY': 'green',
    'THEM_THANH_VIEN': 'blue',
    'SUA_THANH_VIEN': 'orange',
    'XOA_THANH_VIEN': 'red',
    'TAO_TAI_KHOAN': 'purple',
    'CAP_QUYEN_GHI_QUY': 'cyan',
    'THU_HOI_QUYEN_GHI_QUY': 'magenta',
    'DOI_TRANG_THAI_TK': 'volcano',
    'RESET_MAT_KHAU': 'geekblue',
    'DANG_NHAP': 'default',
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch =
        !searchText ||
        String(log.username || '').toLowerCase().includes(searchText.toLowerCase()) ||
        String(log.target || '').toLowerCase().includes(searchText.toLowerCase());

      const matchAction = actionFilter === 'ALL' || log.action === actionFilter;

      return matchSearch && matchAction;
    });
  }, [logs, searchText, actionFilter]);

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 140,
      render: (val) => (
        <span className="text-xs text-slate-500 font-mono">
          {val ? dayjs(val).format('DD/MM/YYYY HH:mm:ss') : '---'}
        </span>
      ),
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'username',
      key: 'username',
      width: 130,
      render: (user) => <span className="font-bold text-xs">@{user}</span>,
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (act) => (
        <Tag color={actionTagColors[act] || 'default'} className="font-semibold text-xs m-0">
          {act}
        </Tag>
      ),
    },
    {
      title: 'Đối tượng',
      dataIndex: 'target',
      key: 'target',
      render: (t) => <span className="font-medium text-xs">{t}</span>,
    },
    {
      title: 'Giá trị cũ',
      dataIndex: 'oldValue',
      key: 'oldValue',
      render: (val) => (
        <span className="text-xs text-slate-400 font-mono truncate max-w-xs block">
          {typeof val === 'object' ? JSON.stringify(val) : String(val || '-')}
        </span>
      ),
    },
    {
      title: 'Giá trị mới',
      dataIndex: 'newValue',
      key: 'newValue',
      render: (val) => (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate max-w-xs block">
          {typeof val === 'object' ? JSON.stringify(val) : String(val || '-')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo user, đối tượng..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="w-full sm:w-60"
            />

            <Select
              value={actionFilter}
              onChange={setActionFilter}
              className="w-full sm:w-48"
              options={[
                { label: 'Tất cả hành động', value: 'ALL' },
                { label: 'Ghi quỹ', value: 'GHI_QUY' },
                { label: 'Thêm thành viên', value: 'THEM_THANH_VIEN' },
                { label: 'Sửa thành viên', value: 'SUA_THANH_VIEN' },
                { label: 'Xoá thành viên', value: 'XOA_THANH_VIEN' },
                { label: 'Cấp/Thu hồi quyền quỹ', value: 'CAP_QUYEN_GHI_QUY' },
                { label: 'Tạo tài khoản', value: 'TAO_TAI_KHOAN' },
                { label: 'Đăng nhập', value: 'DANG_NHAP' },
              ]}
            />
          </div>

          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()} />
        </div>
      </Card>

      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
      ) : isMobile ? (
        /* Mobile Card view */
        <div className="space-y-3">
          {filteredLogs.map(log => (
            <Card
              key={log.id}
              className="shadow-sm border-slate-200 dark:border-slate-800"
              bodyStyle={{ padding: '12px 14px' }}
            >
              <div className="flex justify-between items-start gap-2">
                <Tag color={actionTagColors[log.action] || 'default'} className="font-semibold text-xs m-0">
                  {log.action}
                </Tag>
                <span className="text-[11px] text-slate-400 font-mono">
                  {dayjs(log.timestamp).format('DD/MM HH:mm:ss')}
                </span>
              </div>

              <div className="mt-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">@{log.username}</span>
                <span className="text-slate-400 mx-1">thực hiện trên</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{log.target}</span>
              </div>

              {(log.oldValue || log.newValue) && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block">Cũ:</span>
                    <span className="text-slate-500 truncate block">
                      {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : String(log.oldValue || '-')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Mới:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate block">
                      {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue || '-')}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 850 }}
          />
        </Card>
      )}
    </div>
  );
}
