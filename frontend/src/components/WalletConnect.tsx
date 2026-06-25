'use client';

import React from 'react';
import { Wallet, LogOut, RefreshCw } from 'lucide-react';

interface WalletConnectProps {
  address: string;
  balance: number;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshBalance: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  address,
  balance,
  connecting,
  onConnect,
  onDisconnect,
  onRefreshBalance,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b-2 border-black bg-[#F8F9FA] p-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-black text-[#FF5A00] border border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Wallet size={20} className="stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-black">
            Vault Stream
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
            Stellar Soroban Vesting
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {address ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white font-mono text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-black font-semibold">
                {address.slice(0, 6)}...{address.slice(-6)}
              </span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white font-mono text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-gray-500 uppercase text-[10px] tracking-wider font-bold">Balance:</span>
              <span className="text-black font-black text-base">{balance.toLocaleString()}</span>
              <span className="text-[#FF5A00] font-black text-xs">SV</span>
              <button 
                onClick={onRefreshBalance} 
                className="ml-1 p-1 hover:bg-gray-100 transition-colors text-black"
                title="Refresh balance"
              >
                <RefreshCw size={14} className="stroke-[2]" />
              </button>
            </div>

            <button
              onClick={async () => {
                if (typeof window === 'undefined') return;
                try {
                  const { addToken } = await import('@stellar/freighter-api');
                  const contractId = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || 'CBE6EUK2MXBDXLMWOSD6Y4DQCJOUAMEA5LFIWJCWJ5XQ5FZT4YXDHOTD';
                  const networkPassphrase = 'Test SDF Network ; September 2015';
                  await addToken({
                    contractId,
                    networkPassphrase,
                  });
                } catch (error) {
                  console.error('Failed to add token to Freighter:', error);
                }
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-black bg-white text-black font-bold uppercase tracking-wider text-xs hover:bg-black hover:text-[#FF5A00] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Add SV to Wallet
            </button>

            <button
              onClick={onDisconnect}
              className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-black bg-[#FF5A00] text-black font-bold uppercase tracking-wider text-xs hover:bg-black hover:text-[#FF5A00] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <LogOut size={14} className="stroke-[2.5]" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 border-2 border-black bg-black text-white font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet size={14} className="stroke-[2.5]" />
                Connect Wallet
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
