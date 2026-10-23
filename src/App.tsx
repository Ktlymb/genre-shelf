import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { SelfCheck } from './pages/SelfCheck';

// 哈希路由（§3、§9）。M0 只有自检页；地图页在 M2 完成后，首页改回跳转 /map
const router = createHashRouter([
  { path: '/', element: <Navigate to="/selfcheck" replace /> },
  { path: '/selfcheck', element: <SelfCheck /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
