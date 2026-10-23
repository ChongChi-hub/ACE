/**
 * BẢNG PHÂN QUYỀN TRUNG TÂM (Single source of truth)
 * Hệ thống 2 lớp: Role (theo Chức vụ trong sheet năm) + canEditFund (cột G sheet Account)
 */

export const ROLES = {
  LEADER: 'Leader',
  CO_LEADER: 'Co-Leader',
  QTV: 'QTV',
  THANH_VIEN: 'Thành viên'
};

export const VALID_ROLES = [ROLES.LEADER, ROLES.CO_LEADER, ROLES.QTV, ROLES.THANH_VIEN];
export const ADMIN_ROLES = [ROLES.LEADER, ROLES.CO_LEADER, ROLES.QTV];

export const PERMISSIONS = {
  VIEW_DASHBOARD: [ROLES.LEADER, ROLES.CO_LEADER, ROLES.QTV],
  VIEW_MEMBERS: [ROLES.LEADER, ROLES.CO_LEADER, ROLES.QTV],
  ADD_MEMBER: [ROLES.LEADER, ROLES.CO_LEADER],
  EDIT_MEMBER: [ROLES.LEADER, ROLES.CO_LEADER],
  DELETE_MEMBER: [ROLES.LEADER, ROLES.CO_LEADER],
  CHANGE_ROLE: [ROLES.LEADER],
  VIEW_FUND: [ROLES.LEADER, ROLES.CO_LEADER, ROLES.QTV],
  MANAGE_ACCOUNTS: [ROLES.LEADER],
  VIEW_LOGS: [ROLES.LEADER],
  GRANT_FUND_PERMISSION: [ROLES.LEADER]
};

/**
 * Kiểm tra quyền cơ bản theo role
 */
export function hasPermission(role, permission) {
  if (!role) return false;
  const allowed = PERMISSIONS[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

/**
 * Kiểm tra quyền ghi quỹ:
 * - Leader: luôn được phép
 * - Co-Leader / QTV: chỉ khi canEditFund === true
 */
export function hasFundEditPermission(user) {
  if (!user) return false;
  if (user.role === ROLES.LEADER) return true;
  return user.canEditFund === true;
}

/**
 * Kiểm tra điều kiện xoá thành viên:
 * - Leader: toàn quyền
 * - Co-Leader: không được xoá thành viên đã có đóng góp > 0
 */
export function canDeleteMember(user, member) {
  if (!user) return false;
  if (user.role === ROLES.LEADER) return true;
  if (user.role === ROLES.CO_LEADER) {
    const total = Number(member?.total || member?.tongDongGop || 0);
    return total <= 0;
  }
  return false;
}
