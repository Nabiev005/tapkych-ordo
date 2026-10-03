import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FullCenter, Spinner } from './components/ui';
import Home from './pages/Home';
import Join from './pages/player/Join';

// Телефондор үчүн оюнчунун беттери гана дароо жүктөлөт; алып баруучунун панели жана экран — керек болгондо
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Questions = lazy(() => import('./pages/admin/Questions'));
const ImportPage = lazy(() => import('./pages/admin/Import'));
const NewGame = lazy(() => import('./pages/admin/NewGame'));
const GameControl = lazy(() => import('./pages/admin/GameControl'));
const Pins = lazy(() => import('./pages/admin/Pins'));
const Screen = lazy(() => import('./pages/screen/Screen'));

export default function App() {
  return (
    <Suspense
      fallback={
        <FullCenter>
          <Spinner className="h-12 w-12 text-ordo-gold" />
        </FullCenter>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/screen/:code" element={<Screen />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/games/:id/pins" element={<Pins />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<Questions />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="games/new" element={<NewGame />} />
          <Route path="games/:id" element={<GameControl />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
