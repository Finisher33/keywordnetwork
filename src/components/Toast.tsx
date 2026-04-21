import { ToastType } from '../hooks/useToast';

const ICON: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'warning',
  info: 'info',
};

const COLOR: Record<ToastType, string> = {
  success: 'bg-primary text-on-primary',
  error: 'bg-error text-on-error',
  info: 'bg-on-surface text-surface',
};

export default function Toast({ toast }: { toast: { message: string; type: ToastType } | null }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold max-w-[90vw] pointer-events-none ${COLOR[toast.type]}`}>
      <span className="material-symbols-outlined text-base">{ICON[toast.type]}</span>
      {toast.message}
    </div>
  );
}
