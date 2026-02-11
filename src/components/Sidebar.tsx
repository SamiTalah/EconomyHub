import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, PiggyBank, TrendingUp,
  Landmark, Target, Settings, Menu,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/spending', icon: Receipt, label: 'Utgifter' },
  { to: '/budget', icon: PiggyBank, label: 'Budget' },
  { to: '/investments', icon: TrendingUp, label: 'Investeringar' },
  { to: '/net-worth', icon: Landmark, label: 'Förmögenhet' },
  { to: '/goals', icon: Target, label: 'Sparmål' },
  { to: '/settings', icon: Settings, label: 'Inställningar' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-white border-r border-surface-200
          flex flex-col transition-all duration-300 ease-out
          ${sidebarOpen ? 'w-60' : 'w-0 lg:w-[72px]'}
          lg:relative
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-surface-100 shrink-0 overflow-hidden">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-600 transition-colors shrink-0"
          >
            <Menu size={20} />
          </button>
          {sidebarOpen && (
            <span className="text-base font-bold text-brand-900 whitespace-nowrap">
              EkonomiHubben
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-hidden">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap
                ${isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="px-5 py-4 border-t border-surface-100 text-xs text-surface-400 shrink-0">
            v1.0 — All data stored locally
          </div>
        )}
      </aside>
    </>
  );
}
