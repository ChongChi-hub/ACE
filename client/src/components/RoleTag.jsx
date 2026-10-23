import React from 'react';
import { Tag } from 'antd';
import { CrownFilled, StarFilled, SafetyCertificateFilled, UserOutlined, EditFilled } from '@ant-design/icons';

export function RoleTag({ role, size = 'default' }) {
  switch (role) {
    case 'Leader':
      return (
        <Tag
          color="gold"
          icon={<CrownFilled className="text-amber-500" />}
          className="font-bold border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
        >
          Leader
        </Tag>
      );
    case 'Co-Leader':
      return (
        <Tag
          color="blue"
          icon={<StarFilled className="text-blue-500" />}
          className="font-semibold border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
        >
          Co-Leader
        </Tag>
      );
    case 'QTV':
      return (
        <Tag
          color="cyan"
          icon={<SafetyCertificateFilled className="text-cyan-500" />}
          className="font-semibold border-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300"
        >
          QTV
        </Tag>
      );
    default:
      return (
        <Tag icon={<UserOutlined />} className="text-slate-600 dark:text-slate-400">
          Thành viên
        </Tag>
      );
  }
}

export function FundPermissionTag({ canEditFund }) {
  if (!canEditFund) return null;
  return (
    <Tag
      color="success"
      icon={<EditFilled />}
      className="font-medium bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300"
    >
      Được ghi quỹ
    </Tag>
  );
}
