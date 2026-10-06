import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo, OrnamentBand } from '../../components/Ornament';
import { LangSwitch } from '../../components/LangSwitch';
import { ky } from '../../i18n/ky';
import { adminToken, api, staffUser, type StaffUser } from '../../lib/api';

type Item = { to: string; icon: string; label: string; end?: boolean; external?: boolean };

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = adminToken.get();
  const [user, setUser] = useState<StaffUser | null>(staffUser.get());
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Телефондо башка бетке өткөндө меню жабылат
  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const isAdmin = user?.role !== 'teacher';
  const n = ky.admin.nav;
  const groups: { title: string; items: Item[] }[] = [
    {
      title: ky.admin.navGroups.play,
      items: [
        { to: '/admin', icon: '🏠', label: n.dashboard, end: true },
        { to: '/admin/questions', icon: '❓', label: n.questions },
        { to: '/admin/history', icon: '📜', label: n.history },
      ],
    },
    {
      title: ky.admin.navGroups.school,
      items: [
        { to: '/admin/students', icon: '🎓', label: n.students },
        { to: '/admin/assignments', icon: '📝', label: n.assignments },
        { to: '/rating', icon: '🏆', label: n.rating, external: true },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: ky.admin.navGroups.manage,
            items: [
              { to: '/admin/seasons', icon: '📅', label: n.seasons },
              { to: '/admin/teachers', icon: '👩‍🏫', label: n.teachers },
            ],
          },
        ]
      : []),
  ];

  const logout = () => {
    adminToken.clear();
    navigate('/admin/login');
  };

  const itemClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
      active ? 'bg-ordo-gold text-ordo-night shadow-lg shadow-ordo-gold/20' : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <NavLink to="/admin" className="px-5 pt-6 pb-4">
        <Logo size="sm" />
      </NavLink>
      <OrnamentBand height={10} color="#f5b700" className="opacity-40" />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.2em] text-ordo-sky-light/60 uppercase">{g.title}</div>
            <div className="space-y-0.5">
              {g.items.map((it) =>
                it.external ? (
                  <a key={it.to} href={it.to} target="_blank" rel="noreferrer" className={itemClass(false)}>
                    <span className="w-6 text-center text-lg">{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                    <span className="text-xs opacity-50">↗</span>
                  </a>
                ) : (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => itemClass(isActive)}>
                    <span className="w-6 text-center text-lg">{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                  </NavLink>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <LangSwitch dark />
          <a href="/" target="_blank" rel="noreferrer" className="text-xs font-semibold text-white/50 hover:text-white">
            {ky.admin.openSite} ↗
          </a>
        </div>
        {user && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ordo-gold to-ordo-red font-display text-lg font-black text-white">
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-semibold text-white">{user.name}</div>
              <div className="truncate text-xs text-white/50">{user.role === 'teacher' ? ky.admin.roleTeacher : ky.admin.roleAdmin}</div>
            </div>
            <button
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-white/60 ring-1 ring-white/15 transition hover:bg-ordo-red hover:text-white hover:ring-ordo-red"
              onClick={logout}
            >
              {ky.common.logout}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ordo-cream/40 lg:pl-64 print:pl-0">
      {/* Компьютерде — туруктуу каптал меню */}
      <aside className="no-print bg-night fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* Телефондо — жогорку тилке + ачылма меню */}
      <header className="no-print bg-night sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 lg:hidden">
        <NavLink to="/admin">
          <Logo size="sm" />
        </NavLink>
        <button
          className="rounded-xl bg-white/10 px-3 py-2 font-semibold text-white"
          onClick={() => setMenuOpen(true)}
          aria-label={ky.admin.menu}
        >
          ☰ {ky.admin.menu}
        </button>
      </header>
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="no-print fixed inset-0 z-50 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="no-print bg-night fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <button
                className="absolute top-4 right-4 z-10 rounded-lg px-2 text-2xl text-white/60 hover:text-white"
                onClick={() => setMenuOpen(false)}
                aria-label="✕"
              >
                ✕
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
