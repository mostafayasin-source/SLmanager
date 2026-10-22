import { X } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { describeError } from '../domain/errors';

export function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · SLmanager`;
  }, [title]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const api: ToastApi = {
    success: (message) => setToast({ id: Date.now(), message, tone: 'success' }),
    error: (message) => setToast({ id: Date.now(), message, tone: 'error' }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast ? (
          <div key={toast.id} className={cx('toast', toast.tone)} role="status">
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('ToastProvider saknas.');
  return value;
}

export function useSafeAction(): (action: () => void, success?: string) => boolean {
  const toast = useToast();
  return (action, success) => {
    try {
      action();
      if (success) toast.success(success);
      return true;
    } catch (error) {
      toast.error(describeError(error));
      return false;
    }
  };
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-mark" aria-hidden="true">
        SL
      </span>
      <span>manager</span>
    </span>
  );
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button type={type} className={cx('btn', `btn-${variant}`, className)} {...props} />;
}

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span className="req" aria-hidden="true">
          {' '}
          *
        </span>
        <span className="sr-only"> (obligatoriskt)</span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OptionalField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const focusTarget = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('input, select, textarea');
    focusTarget?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog wide' : 'dialog'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-card">
        <header className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Stäng">
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="dialog-text">{body}</p>
      <div className="dialog-actions">
        <Button variant="secondary" data-autofocus onClick={onClose}>
          Avbryt
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function PageHeader({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function describedBy(id: string, error?: string): string | undefined {
  return error ? `${id}-error` : undefined;
}
