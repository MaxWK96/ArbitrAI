import { Routes, Route } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import HomePage from './pages/HomePage.tsx';
import CreateDisputePage from './pages/CreateDisputePage.tsx';
import DisputePage from './pages/DisputePage.tsx';
import DemoPage from './pages/DemoPage.tsx';
import type { WalletState } from './lib/wallet.ts';

export default function App() {
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const handleWalletConnected = useCallback((w: WalletState) => {
    setWallet(w);
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        wallet={wallet}
        onConnected={handleWalletConnected}
        onDisconnect={handleDisconnect}
      />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage wallet={wallet} />} />
          <Route path="/create" element={<CreateDisputePage wallet={wallet} />} />
          <Route path="/dispute/:id" element={<DisputePage wallet={wallet} />} />
          <Route path="/demo" element={<DemoPage />} />
        </Routes>
      </main>
      <footer className="border-t border-gray-800 py-6 mt-16">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-gray-500">
          <span>ArbitrAI — Chainlink Convergence Hackathon 2026</span>
          <div className="flex gap-4">
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer"
               className="hover:text-gray-300 transition-colors">Etherscan</a>
            <a href="https://github.com" target="_blank" rel="noreferrer"
               className="hover:text-gray-300 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
