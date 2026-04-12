import { useState, useEffect } from 'react';

// Subscribes to process.stdout 'resize' and returns live terminal dimensions.
// Any component using this hook will re-render automatically on resize.
export function useTerminalSize() {
  const [size, setSize] = useState({
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows    ?? 24,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        cols: process.stdout.columns ?? 80,
        rows: process.stdout.rows    ?? 24,
      });
    };

    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  return size;
}
