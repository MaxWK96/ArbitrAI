import { BrowserProvider, ethers } from 'ethers';
import { SEPOLIA_CONFIG } from './contracts.js';

export type WalletState = {
  address: string;
  provider: BrowserProvider;
  signer: ethers.Signer;
  chainId: number;
};

export async function connectWallet(): Promise<WalletState> {
  if (!window.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask.');
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // Switch to Sepolia if needed
  if (chainId !== 11155111) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CONFIG.chainId }],
      });
    } catch (switchError: unknown) {
      // Chain not added yet — add it
      if ((switchError as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_CONFIG],
        });
      } else {
        throw switchError;
      }
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { address, provider, signer, chainId: 11155111 };
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatETH(wei: bigint, decimals = 4): string {
  const eth = parseFloat(ethers.formatEther(wei));
  return eth.toFixed(decimals) + ' ETH';
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
