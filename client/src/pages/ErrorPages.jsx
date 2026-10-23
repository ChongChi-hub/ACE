import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Result
        status="403"
        title="403 - Không Có Quyền Truy Cập"
        subTitle="Xin lỗi, bạn không có quyền hạn cần thiết để truy cập chức năng này."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')} className="bg-amber-500 font-bold border-none">
            Về Trang Chủ
          </Button>
        }
      />
    </div>
  );
}

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Result
        status="404"
        title="404 - Không Tìm Thấy Trang"
        subTitle="Đường dẫn bạn yêu cầu không tồn tại hoặc đã bị di chuyển."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')} className="bg-amber-500 font-bold border-none">
            Về Trang Chủ
          </Button>
        }
      />
    </div>
  );
}
