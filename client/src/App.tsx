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
const Students = lazy(() => import('./pages/admin/Students'));
const History = lazy(() => import('./pages/admin/History'));
const Rating = lazy(() => import('./pages/Rating'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const Certificate = lazy(() => import('./pages/Certificate'));
const Watch = lazy(() => import('./pages/player/Watch'));
const Homework = lazy(() => import('./pages/player/Homework'));
const Teachers = lazy(() => import('./pages/admin/Teachers'));
const Seasons = lazy(() => import('./pages/admin/Seasons'));
const Assignments = lazy(() => import('./pages/admin/Assignments'));
const AssignmentDetail = lazy(() => import('./pages/admin/AssignmentDetail'));
const Replay = lazy(() => import('./pages/admin/Replay'));
const Legal = lazy(() => import('./pages/Legal'));

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
        <Route path="/rating" element={<Rating />} />
        <Route path="/rating/student/:id" element={<StudentProfile />} />
        <Route path="/certificate" element={<Certificate />} />
        <Route path="/watch/:code" element={<Watch />} />
        <Route path="/hw/:code" element={<Homework />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/admin/games/:id/replay" element={<Replay />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/games/:id/pins" element={<Pins />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<Questions />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="students" element={<Students />} />
          <Route path="history" element={<History />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="seasons" element={<Seasons />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="assignments/:id" element={<AssignmentDetail />} />
          <Route path="games/new" element={<NewGame />} />
          <Route path="games/:id" element={<GameControl />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
