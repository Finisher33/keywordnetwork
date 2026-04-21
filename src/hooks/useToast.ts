import { useState, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { toast, showToast };
}
