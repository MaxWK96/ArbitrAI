import { Routes, Route, useLocation } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Header from './components/Header.tsx';
import HomePage from './pages/HomePage.tsx';
import CreateDisputePage from './pages/CreateDisputePage.tsx';
import DisputePage from './pages/DisputePage.tsx';
import DemoPage from './pages/DemoPage.tsx';
import NotFound from './pages/NotFound.tsx';
import type { WalletState } from './lib/wallet.ts';

const queryClient = new QueryClient();

function AppRoutes() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  const handleWalletConnected = useCallback((w: WalletState) => {
    setWallet(w);
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global header only on functional pages — landing page has its own Navbar */}
      {!isLanding && (
        <Header
          wallet={wallet}
          onConnected={handleWalletConnected}
          onDisconnect={handleDisconnect}
        />
      )}
      {/* pt-16 offsets the fixed header on functional pages */}
      <main className={`flex-1 ${!isLanding ? 'pt-16' : ''}`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateDisputePage wallet={wallet} />} />
          <Route path="/dispute/:id" element={<DisputePage wallet={wallet} />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
