import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppStore } from '../stores/appStore';

export default function Layout() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto transition-all duration-300
          ${sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
