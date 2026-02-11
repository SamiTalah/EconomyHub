import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/dashboard/Dashboard';
import SpendingPage from './components/spending/SpendingPage';
import BudgetPage from './components/budget/BudgetPage';
import InvestmentsPage from './components/investments/InvestmentsPage';
import NetWorthPage from './components/networth/NetWorthPage';
import GoalsPage from './components/goals/GoalsPage';
import SettingsPage from './components/settings/SettingsPage';
import { seedDatabase } from './db/database';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-surface-500">Laddar EkonomiHubben...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/spending" element={<SpendingPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/net-worth" element={<NetWorthPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
