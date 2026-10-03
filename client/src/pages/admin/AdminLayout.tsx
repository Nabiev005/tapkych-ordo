import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { ky } from '../../i18n/ky';
import { adminToken, api } from '../../lib/api';

export default function AdminLayout() {
  const navigate = useNavigate();
  const token = adminToken.get();

  useEffect(() => {
    // Токен али жарактуубу — жарактуу эмес болсо api өзү логинге жөнөтөт
    if (token) api.get('/api/auth/me').catch(() => undefined);
  }, [token]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-4 py-2 font-semibold transition ${isActive ? 'bg-ordo-red text-white shadow' : 'text-ordo-ink/70 hover:bg-ordo-gold/15'}`;

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b border-ordo-gold/30 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <NavLink to="/admin">
            <Logo size="sm" onDark={false} />
          </NavLink>
          <nav className="flex flex-1 flex-wrap gap-1">
            <NavLink to="/admin" end className={link}>
              {ky.admin.nav.dashboard}
            </NavLink>
            <NavLink to="/admin/questions" className={link}>
              {ky.admin.nav.questions}
            </NavLink>
          </nav>
          <button
            className="rounded-xl px-4 py-2 font-semibold text-ordo-ink/60 hover:bg-ordo-red/10 hover:text-ordo-red"
            onClick={() => {
              adminToken.clear();
              navigate('/admin/login');
            }}
          >
            {ky.common.logout}
          </button>
        </div>
        <OrnamentBand height={12} color="#c8102e" />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
