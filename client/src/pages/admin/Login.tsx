import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { Button } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { ApiError, adminToken, api } from '../../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.post<{ token: string }>('/api/auth/login', { username, password });
      adminToken.set(token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ky.errors.UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-night flex min-h-dvh flex-col">
      <OrnamentBand />
      <div className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
        <Logo size="lg" />
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card w-full max-w-sm space-y-4 p-7"
        >
          <h1 className="text-center font-display text-xl font-bold">{ky.admin.loginTitle}</h1>
          <div>
            <label className="label">{ky.admin.username}</label>
            <input className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">{ky.admin.password}</label>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="rounded-xl bg-ordo-red/10 px-4 py-3 text-center font-semibold text-ordo-red">{error}</div>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!username || !password}>
            {busy ? ky.admin.loggingIn : ky.admin.login}
          </Button>
        </motion.form>
      </div>
      <OrnamentBand flip />
    </div>
  );
}
