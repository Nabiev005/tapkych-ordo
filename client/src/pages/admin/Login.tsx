import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { LangSwitch } from '../../components/LangSwitch';
import { GoogleButton } from '../../components/GoogleButton';
import { Button } from '../../components/ui';
import { ky } from '../../i18n/ky';
import { ApiError, adminToken, api, staffUser, type StaffUser } from '../../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ googleClientId: string | null }>('/api/auth/config')
      .then((r) => setGoogleClientId(r.googleClientId))
      .catch(() => undefined);
  }, []);

  const signIn = async (path: string, body: unknown) => {
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.post<{ token: string; user: StaffUser }>(path, body);
      adminToken.set(token);
      staffUser.set(user);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ky.errors.UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn('/api/auth/login', { username, password });
  };

  return (
    <div className="bg-night flex min-h-dvh flex-col">
      <OrnamentBand />
      <div className="flex justify-end px-4 pt-3">
        <LangSwitch dark />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
        <Logo size="lg" />
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card w-full max-w-sm space-y-4 p-7"
        >
          <h1 className="text-center font-display text-xl font-bold">{ky.admin.loginTitle}</h1>
          {googleClientId && (
            <>
              <GoogleButton clientId={googleClientId} onCredential={(credential) => void signIn('/api/auth/google', { credential })} />
              <div className="flex items-center gap-3 text-xs font-semibold text-ordo-ink/45">
                <span className="h-px flex-1 bg-ordo-ink/15" />
                {ky.admin.loginOr}
                <span className="h-px flex-1 bg-ordo-ink/15" />
              </div>
            </>
          )}
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
