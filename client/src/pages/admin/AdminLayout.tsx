import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { LangSwitch } from '../../components/LangSwitch';
import { ky } from '../../i18n/ky';
import { adminToken, api, staffUser, type StaffUser } from '../../lib/api';

export default function AdminLayout() {
  const navigate = useNavigate();
  const token = adminToken.get();
  const [user, setUser] = useState<StaffUser | null>(staffUser.get());

  useEffect(() => {
    // Токен али жарактуубу — жарактуу эмес болсо api өзү логинге жөнөтөт
    if (token)
      api
        .get<{ user: StaffUser }>('/api/auth/me')
        .then((r) => {
          staffUser.set(r.user);
          setUser(r.user);
        })
        .catch(() => undefined);
  }, [token]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const isAdmin = user?.role !== 'teacher';
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3 py-2 font-semibold transition ${isActive ? 'bg-ordo-red text-white shadow' : 'text-ordo-ink/70 hover:bg-ordo-gold/15'}`;

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b border-ordo-gold/30 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/admin">
            <Logo size="sm" onDark={false} />
          </NavLink>
          <nav className="flex flex-1 flex-wrap gap-0.5">
            <NavLink to="/admin" end className={link}>
              {ky.admin.nav.dashboard}
            </NavLink>
            <NavLink to="/admin/questions" className={link}>
              {ky.admin.nav.questions}
            </NavLink>
            <NavLink to="/admin/students" className={link}>
              {ky.admin.nav.students}
            </NavLink>
            <NavLink to="/admin/assignments" className={link}>
              {ky.admin.nav.assignments}
            </NavLink>
            <NavLink to="/admin/history" className={link}>
              {ky.admin.nav.history}
            </NavLink>
            {isAdmin && (
              <>
                <NavLink to="/admin/seasons" className={link}>
                  {ky.admin.nav.seasons}
                </NavLink>
                <NavLink to="/admin/teachers" className={link}>
                  {ky.admin.nav.teachers}
                </NavLink>
              </>
            )}
            <a href="/rating" target="_blank" rel="noreferrer" className={link({ isActive: false })}>
              🏆 {ky.admin.nav.rating}
            </a>
          </nav>
          <LangSwitch />
          {user && (
            <div className="text-right text-xs leading-tight">
              <div className="font-semibold text-ordo-ink">{user.name}</div>
              <div className="text-ordo-ink/50">{user.role === 'teacher' ? ky.admin.roleTeacher : ky.admin.roleAdmin}</div>
            </div>
          )}
          <button
            className="rounded-xl px-3 py-2 font-semibold text-ordo-ink/60 hover:bg-ordo-red/10 hover:text-ordo-red"
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
