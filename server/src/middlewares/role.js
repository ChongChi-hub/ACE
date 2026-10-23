import { hasPermission } from '../config/permissions.js';

/**
 * Middleware kiểm tra quyền theo Role
 */
export function requireRole(allowedRoles) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng!'
      });
    }

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện thao tác này! Yêu cầu vai trò: ${rolesArray.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Middleware kiểm tra quyền theo Permission định nghĩa trong config/permissions.js
 */
export function requirePermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng!'
      });
    }

    if (!hasPermission(req.user.role, permissionName)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này!'
      });
    }

    next();
  };
}
