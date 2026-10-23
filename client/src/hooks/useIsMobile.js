import { useState, useEffect } from 'react';
import { Grid } from 'antd';

const { useBreakpoint } = Grid;

export function useIsMobile() {
  const screens = useBreakpoint();
  const [isMobileWidth, setIsMobileWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileWidth(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Nếu screens.md đã tính toán được thì ưu tiên (nếu screens.md === false là mobile)
  if (screens.md !== undefined) {
    return !screens.md;
  }

  return isMobileWidth;
}
