import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ky } from '../i18n/ky';

// ─────────────────────────── Баскыч ───────────────────────────

type Variant = 'red' | 'gold' | 'sky' | 'green' | 'dark' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  red: 'bg-gradient-to-b from-[#e0213f] to-ordo-red-dark text-white shadow-[0_6px_0_#6e0818] hover:brightness-110',
  gold: 'bg-gradient-to-b from-ordo-gold-light to-ordo-gold text-ordo-ink shadow-[0_6px_0_#a07800] hover:brightness-105',
  sky: 'bg-gradient-to-b from-[#3cb8ef] to-[#0d86c0] text-white shadow-[0_6px_0_#075e88] hover:brightness-110',
  green: 'bg-gradient-to-b from-[#22c983] to-[#0e9a62] text-white shadow-[0_6px_0_#076b43] hover:brightness-110',
  dark: 'bg-ordo-night text-white shadow-[0_6px_0_#030a16] hover:bg-[#13294f]',
  ghost: 'bg-transparent text-current hover:bg-black/5',
  outline: 'border-2 border-ordo-gold/50 bg-white text-ordo-ink hover:border-ordo-gold hover:bg-ordo-gold/10',
  danger: 'bg-white text-ordo-red border-2 border-ordo-red/30 hover:bg-ordo-red hover:text-white',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-xl gap-1.5',
  md: 'px-5 py-2.5 text-base rounded-2xl gap-2',
  lg: 'px-6 py-4 text-lg rounded-2xl gap-2.5 font-bold',
  xl: 'px-8 py-6 text-2xl rounded-3xl gap-3 font-black font-display tracking-wide',
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  pulse?: boolean;
}

export function Button({ variant = 'red', size = 'md', loading, icon, pulse, className = '', children, disabled, ...rest }: ButtonProps) {
  const off = disabled || loading;
  return (
    <motion.button
      whileTap={off ? undefined : { scale: 0.96, y: 3 }}
      className={`relative inline-flex select-none items-center justify-center font-semibold transition-[filter,background-color,opacity] ${VARIANTS[variant]} ${SIZES[size]} ${off ? 'opacity-40 shadow-none saturate-50' : ''} ${className}`}
      disabled={off}
      {...rest}
    >
      {pulse && !off && <span className="pointer-events-none absolute -inset-1.5 animate-pulse rounded-[inherit] border-4 border-ordo-gold/70" />}
      {loading ? <Spinner /> : icon}
      {children}
    </motion.button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-[3px] border-current border-t-transparent ${className}`} />;
}

// ─────────────────────────── Модалдык терезе ───────────────────────────

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ordo-deep/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-ordo-cream shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
            initial={{ y: 40, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="h-2 rounded-t-3xl bg-gradient-to-r from-ordo-red via-ordo-gold to-ordo-sky" />
            <div className="p-6">
              {title && <h2 className="mb-4 font-display text-xl font-bold text-ordo-ink">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────── Ырастоо жана киргизүү терезелери ───────────────────────────

interface ConfirmOpts {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface PromptOpts {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  type?: 'text' | 'number';
}

type Dialog =
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOpts);

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'err';
}

const DialogCtx = createContext<{
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  toast: (text: string, kind?: 'ok' | 'err') => void;
}>(null!);

export const useDialogs = () => useContext(DialogCtx);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [value, setValue] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', resolve, ...o })), []);
  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(o.defaultValue ?? '');
        setDialog({ kind: 'prompt', resolve, ...o });
      }),
    [],
  );
  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 5000 : 2500);
  }, []);

  const close = (result: boolean) => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(result);
    else dialog.resolve(result ? value.trim() : null);
    setDialog(null);
  };

  return (
    <DialogCtx.Provider value={{ confirm, prompt, toast }}>
      {children}
      <Modal open={!!dialog} onClose={() => close(false)} title={dialog?.title}>
        {dialog?.kind === 'confirm' && dialog.message && <div className="mb-6 text-lg leading-relaxed text-ordo-ink/80">{dialog.message}</div>}
        {dialog?.kind === 'prompt' && (
          <form
            className="mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) close(true);
            }}
          >
            {dialog.label && <label className="label">{dialog.label}</label>}
            <input
              autoFocus
              className="input"
              type={dialog.type ?? 'text'}
              value={value}
              placeholder={dialog.placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          </form>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => close(false)}>
            {(dialog?.kind === 'confirm' && dialog.cancelText) || ky.common.cancel}
          </Button>
          <Button
            variant={dialog?.kind === 'confirm' && dialog.danger ? 'red' : 'green'}
            size="lg"
            disabled={dialog?.kind === 'prompt' && !value.trim()}
            onClick={() => close(true)}
          >
            {dialog?.confirmText ?? ky.common.confirm}
          </Button>
        </div>
      </Modal>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`pointer-events-auto max-w-md rounded-2xl px-5 py-3 text-center font-semibold text-white shadow-xl ${t.kind === 'ok' ? 'bg-emerald-600' : 'bg-ordo-red'}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DialogCtx.Provider>
  );
}

// ─────────────────────────── Майда компоненттер ───────────────────────────

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-ordo-ink/50">{hint}</p>}
    </div>
  );
}

export function ConnBadge({ status, dark }: { status: string; dark?: boolean }) {
  if (status === 'online') return null;
  return (
    <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-semibold shadow-lg ${dark ? 'bg-ordo-red text-white' : 'bg-ordo-red text-white'}`}>
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
      {status === 'connecting' ? ky.common.connecting : ky.common.reconnecting}
    </div>
  );
}

export function FullCenter({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return <div className={`flex min-h-dvh flex-col items-center justify-center p-6 text-center ${dark ? 'bg-night text-white' : ''}`}>{children}</div>;
}
