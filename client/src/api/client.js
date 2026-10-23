/**
 * API Client kết nối trực tiếp Google Apps Script Web App hoặc Backend Server
 */

// Lấy URL Apps Script từ biến môi trường hoặc cấu hình trong LocalStorage
export const getAppsScriptUrl = () => {
  return (
    localStorage.getItem('ace_sun_apps_script_url') ||
    import.meta.env.VITE_APPS_SCRIPT_URL ||
    ''
  ).trim();
};

export const setAppsScriptUrl = (url) => {
  if (url) {
    localStorage.setItem('ace_sun_apps_script_url', url.trim());
  } else {
    localStorage.removeItem('ace_sun_apps_script_url');
  }
};

/**
 * Gọi hàm tới Google Apps Script Web App
 */
async function callAppsScript(action, payload = {}) {
  const url = getAppsScriptUrl();
  if (!url) {
    throw new Error('Chưa cấu hình URL Google Apps Script Web App. Vui lòng cài đặt URL trong hệ thống.');
  }

  // Lấy thông tin user hiện tại để gắn actor vào log
  let actor = 'Ban Quản Trị';
  try {
    const storedUser = JSON.parse(localStorage.getItem('ace_sun_user') || '{}');
    if (storedUser.tenIngame || storedUser.username) {
      actor = `${storedUser.tenIngame || storedUser.username} (${storedUser.role || 'QTV'})`;
    }
  } catch (e) {}

  const bodyData = {
    action,
    actor,
    ...payload
  };

  try {
    // Gắn params vào URL query để bảo toàn 100% dữ liệu khi Google redirect 302
    const queryParams = new URLSearchParams();
    queryParams.set('action', action);
    queryParams.set('actor', actor);
    Object.keys(payload).forEach(k => {
      if (typeof payload[k] === 'object' && payload[k] !== null) {
        queryParams.set(k, JSON.stringify(payload[k]));
      } else if (payload[k] !== undefined && payload[k] !== null) {
        queryParams.set(k, String(payload[k]));
      }
    });

    const targetUrl = url.includes('?') ? `${url}&${queryParams.toString()}` : `${url}?${queryParams.toString()}`;

    // Gửi request tới Google Apps Script
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(bodyData),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ Google (${response.status})`);
    }

    const data = await response.json();
    if (data.success === false) {
      throw new Error(data.message || 'Thao tác không thành công');
    }

    return data;
  } catch (error) {
    console.error(`[AppsScript API Error] ${action}:`, error);
    throw error;
  }
}

/**
 * Bộ chuyển đổi REST-like sang Google Apps Script
 */
const api = {
  async get(endpoint) {
    const appsScriptUrl = getAppsScriptUrl();
    const [path, queryString] = endpoint.split('?');
    const params = new URLSearchParams(queryString || '');

    // 1. Lấy thông tin phiên đăng nhập
    if (path === '/auth/me') {
      const stored = localStorage.getItem('ace_sun_user');
      if (!stored) {
        const err = new Error('Chưa đăng nhập');
        err.response = { status: 401 };
        throw err;
      }
      return { data: { user: JSON.parse(stored) } };
    }

    // 2. Lấy dữ liệu thành viên & quỹ
    if (path === '/members') {
      const year = params.get('year') || '2026';
      const res = await callAppsScript('get_members', { year });
      return {
        data: {
          success: true,
          data: res,
          ...res
        }
      };
    }

    // 3. Lấy danh sách tài khoản
    if (path === '/accounts') {
      const res = await callAppsScript('get_accounts');
      const list = res.accounts || [];
      return {
        data: {
          success: true,
          data: list,
          accounts: list
        }
      };
    }

    // 4. Lấy nhật ký log
    if (path === '/logs') {
      const limit = parseInt(params.get('limit') || '300', 10);
      const res = await callAppsScript('get_logs', { limit });
      const list = res.logs || [];
      return {
        data: {
          success: true,
          data: list,
          logs: list
        }
      };
    }

    throw new Error(`Endpoint GET không hỗ trợ: ${path}`);
  },

  async post(endpoint, body = {}) {
    const [path, queryString] = endpoint.split('?');
    const params = new URLSearchParams(queryString || '');

    // Đăng nhập
    if (path === '/auth/login') {
      const res = await callAppsScript('login', {
        username: body.username,
        password: body.password
      });

      const token = 'apps_script_token_' + Date.now();
      localStorage.setItem('ace_sun_token', token);
      localStorage.setItem('ace_sun_user', JSON.stringify(res.user));

      return {
        data: {
          accessToken: token,
          user: res.user,
          message: res.message
        }
      };
    }

    // Đăng xuất
    if (path === '/auth/logout') {
      localStorage.removeItem('ace_sun_token');
      localStorage.removeItem('ace_sun_user');
      return { data: { success: true } };
    }

    // Đổi mật khẩu
    if (path === '/auth/change-password') {
      let username = 'binhbinh';
      try {
        const u = JSON.parse(localStorage.getItem('ace_sun_user') || '{}');
        if (u.username) username = u.username;
      } catch (e) {}

      const res = await callAppsScript('change_password', {
        username,
        oldPassword: body.oldPassword,
        newPassword: body.newPassword
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Thêm thành viên
    if (path === '/members') {
      const year = params.get('year') || '2026';
      const res = await callAppsScript('add_member', {
        year,
        ...body
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Ghi quỹ
    if (path === '/fund/record') {
      const year = params.get('year') || '2026';
      const res = await callAppsScript('record_fund', {
        year,
        rowIndex: body.rowIndex,
        field: body.field,
        amount: body.amount
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Tạo tài khoản mới
    if (path === '/accounts') {
      const res = await callAppsScript('create_account', body);
      return { data: { success: true, data: res, ...res } };
    }

    // Reset password
    const resetMatch = path.match(/^\/accounts\/([^/]+)\/reset-password$/);
    if (resetMatch) {
      const username = decodeURIComponent(resetMatch[1]);
      const res = await callAppsScript('reset_password', {
        username,
        newPassword: body.newPassword
      });
      return { data: { success: true, data: res, ...res } };
    }

    throw new Error(`Endpoint POST không hỗ trợ: ${path}`);
  },

  async put(endpoint, body = {}) {
    const [path, queryString] = endpoint.split('?');
    const params = new URLSearchParams(queryString || '');

    // Chỉnh sửa thành viên /members/:rowIndex
    const memberMatch = path.match(/^\/members\/(\d+)$/);
    if (memberMatch) {
      const rowIndex = parseInt(memberMatch[1], 10);
      const year = params.get('year') || '2026';
      const res = await callAppsScript('edit_member', {
        year,
        rowIndex,
        ...body
      });
      return { data: { success: true, data: res, ...res } };
    }

    throw new Error(`Endpoint PUT không hỗ trợ: ${path}`);
  },

  async patch(endpoint, body = {}) {
    const [path] = endpoint.split('?');

    // Cập nhật quyền ghi quỹ
    const permMatch = path.match(/^\/accounts\/([^/]+)\/fund-permission$/);
    if (permMatch) {
      const username = decodeURIComponent(permMatch[1]);
      const res = await callAppsScript('update_account_fund_permission', {
        username,
        canEditFund: body.canEditFund
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Cập nhật quyền quản lý thành viên
    const memberPermMatch = path.match(/^\/accounts\/([^/]+)\/member-permission$/);
    if (memberPermMatch) {
      const username = decodeURIComponent(memberPermMatch[1]);
      const res = await callAppsScript('update_account_member_permission', {
        username,
        canManageMembers: body.canManageMembers
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Cập nhật trạng thái tài khoản
    const statusMatch = path.match(/^\/accounts\/([^/]+)\/status$/);
    if (statusMatch) {
      const username = decodeURIComponent(statusMatch[1]);
      const res = await callAppsScript('update_account_status', {
        username,
        status: body.status
      });
      return { data: { success: true, data: res, ...res } };
    }

    throw new Error(`Endpoint PATCH không hỗ trợ: ${path}`);
  },

  async delete(endpoint, config = {}) {
    const [path, queryString] = endpoint.split('?');
    const params = new URLSearchParams(queryString || '');

    // Xoá thành viên /members/:rowIndex
    const memberMatch = path.match(/^\/members\/(\d+)$/);
    if (memberMatch) {
      const rowIndex = parseInt(memberMatch[1], 10);
      const year = params.get('year') || '2026';
      const res = await callAppsScript('delete_member', {
        year,
        rowIndex
      });
      return { data: { success: true, data: res, ...res } };
    }

    // Xoá tài khoản /accounts/:username
    const accMatch = path.match(/^\/accounts\/([^/]+)$/);
    if (accMatch) {
      const username = decodeURIComponent(accMatch[1]);
      const res = await callAppsScript('delete_account', { username });
      return { data: { success: true, data: res, ...res } };
    }

    throw new Error(`Endpoint DELETE không hỗ trợ: ${path}`);
  }
};

export default api;
