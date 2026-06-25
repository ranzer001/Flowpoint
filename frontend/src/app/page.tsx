'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WalletConnect } from '../components/WalletConnect';
import { CreateStreamForm } from '../components/CreateStreamForm';
import { Dashboard } from '../components/Dashboard';
import { ActivityFeed, ActivityEvent } from '../components/ActivityFeed';
import {
  connectWallet,
  getTokenBalance,
  listStreamsFor,
  getStreamDetails,
  createStream,
  withdrawFromStream,
  cancelStream,
  StreamInfo,
} from '../lib/stellar';
import { ShieldCheck, Flame } from 'lucide-react';

export default function Home() {
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingWithdrawId, setLoadingWithdrawId] = useState<number | null>(null);
  const [loadingCancelId, setLoadingCancelId] = useState<number | null>(null);
  
  const [errorNotice, setErrorNotice] = useState<{ message: string; type: 'error' | 'info' | 'warning' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Parse error messages into user-friendly notices
  const parseError = (err: unknown) => {
    let msg = '';
    if (err instanceof Error) {
      msg = err.message;
    } else if (err && typeof err === 'object') {
      if ('message' in err && typeof (err as Record<string, unknown>).message === 'string') {
        msg = (err as Record<string, unknown>).message as string;
      } else {
        try {
          msg = JSON.stringify(err);
        } catch {
          msg = String(err);
        }
      }
    } else {
      msg = String(err);
    }

    if (!msg || msg === '{}' || msg === '[object Object]') {
      msg = 'An unknown wallet or network error occurred.';
    }

    console.error('Captured Error:', msg);

    if (msg.toLowerCase().includes('freighter') && msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('wallet not found')) {
      return {
        message: 'Freighter extension not found. Please install Freighter from freighter.app to connect.',
        type: 'warning' as const,
      };
    }
    if (msg.toLowerCase().includes('user reject') || msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('declined') || msg.toLowerCase().includes('closed')) {
      return {
        message: 'Signature request cancelled. No changes were made.',
        type: 'info' as const,
      };
    }
    if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
      return {
        message: 'Insufficient balance to complete the transaction.',
        type: 'error' as const,
      };
    }
    return {
      message: msg || 'Transaction failed. Please try again.',
      type: 'error' as const,
    };
  };

  const loadBlockchainData = useCallback(async (userAddress: string) => {
    if (!userAddress) return;
    setRefreshing(true);
    setErrorNotice(null);
    try {
      // Get balance
      const tokenBal = await getTokenBalance(userAddress);
      setBalance(tokenBal);

      // Get streams list
      const streamIds = await listStreamsFor(userAddress);
      
      const streamList: StreamInfo[] = [];
      for (const id of streamIds) {
        const details = await getStreamDetails(id);
        if (details) {
          streamList.push(details);
        }
      }
      setStreams(streamList);
    } catch (err) {
      setErrorNotice(parseError(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorNotice(null);
    try {
      const walletAddr = await connectWallet();
      setAddress(walletAddr);
      await loadBlockchainData(walletAddr);
    } catch (err) {
      setErrorNotice(parseError(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress('');
    setBalance(0);
    setStreams([]);
    setErrorNotice({
      message: 'Wallet disconnected successfully.',
      type: 'info',
    });
  };

  const handleCreateStream = async (recipient: string, amount: number, duration: number) => {
    setCreating(true);
    setErrorNotice(null);
    try {
      const txHash = await createStream(address, recipient, amount, duration);
      
      // Add event to feed
      const newEvent: ActivityEvent = {
        id: Math.random().toString(),
        type: 'created',
        streamId: streams.length + 1, // temporary mock ID calculation for feed
        amount,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setEvents(prev => [newEvent, ...prev]);

      setErrorNotice({
        message: `Vesting stream of ${amount} SV initiated successfully! Hash: ${txHash.slice(0, 16)}...`,
        type: 'info',
      });

      // Reload
      await loadBlockchainData(address);
    } catch (err) {
      setErrorNotice(parseError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleWithdraw = async (streamId: number) => {
    setLoadingWithdrawId(streamId);
    setErrorNotice(null);
    try {
      const txHash = await withdrawFromStream(address, streamId);

      // Find stream details to log amount
      const targetStream = streams.find(s => s.id === streamId);
      const amountWithdrawn = targetStream ? (targetStream.deposit - targetStream.withdrawn) : 0; // estimation

      const newEvent: ActivityEvent = {
        id: Math.random().toString(),
        type: 'withdrawn',
        streamId,
        amount: amountWithdrawn,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setEvents(prev => [newEvent, ...prev]);

      setErrorNotice({
        message: `Tokens withdrawn successfully! Hash: ${txHash.slice(0, 16)}...`,
        type: 'info',
      });

      await loadBlockchainData(address);
    } catch (err) {
      setErrorNotice(parseError(err));
    } finally {
      setLoadingWithdrawId(null);
    }
  };

  const handleCancel = async (streamId: number) => {
    setLoadingCancelId(streamId);
    setErrorNotice(null);
    try {
      const txHash = await cancelStream(address, streamId);

      const newEvent: ActivityEvent = {
        id: Math.random().toString(),
        type: 'cancelled',
        streamId,
        amount: 0, // remainder returned
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setEvents(prev => [newEvent, ...prev]);

      setErrorNotice({
        message: `Stream cancelled successfully. Remaining unvested funds returned to sender. Hash: ${txHash.slice(0, 16)}...`,
        type: 'info',
      });

      await loadBlockchainData(address);
    } catch (err) {
      setErrorNotice(parseError(err));
    } finally {
      setLoadingCancelId(null);
    }
  };

  // Poll blockchain data every 8 seconds when connected
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => {
      loadBlockchainData(address);
    }, 8000);
    return () => clearInterval(interval);
  }, [address, loadBlockchainData]);

  return (
    <main className="min-h-screen bg-[#FFFDF9] text-black pb-16">
      {/* Top Banner Wallet Panel */}
      <WalletConnect
        address={address}
        balance={balance}
        connecting={connecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefreshBalance={() => loadBlockchainData(address)}
      />

      {/* Main content grid */}
      <div className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        {/* User feedback / alerts panel */}
        {errorNotice && (
          <div 
            className={`p-4 border-2 border-black font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
              errorNotice.type === 'error'
                ? 'bg-rose-50 border-rose-600 text-rose-800'
                : errorNotice.type === 'warning'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-emerald-50 border-emerald-500 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">[{errorNotice.type.toUpperCase()}]</span>
              <span>{errorNotice.message}</span>
            </div>
            <button 
              onClick={() => setErrorNotice(null)} 
              className="font-bold hover:underline font-mono text-[10px] uppercase ml-4 text-black border border-black px-1.5 py-0.5 bg-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {address ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left panels: forms & logs */}
            <div className="lg:col-span-1 space-y-8">
              <CreateStreamForm
                balance={balance}
                onSubmit={handleCreateStream}
                loading={creating}
              />

              <ActivityFeed events={events} />
            </div>

            {/* Right panel: Active streams board */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
                <h2 className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                  <ShieldCheck size={20} className="text-[#FF5A00]" />
                  Active Streams
                </h2>
                {refreshing && (
                  <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">
                    Syncing...
                  </span>
                )}
              </div>

              <Dashboard
                streams={streams}
                currentUserAddress={address}
                onWithdraw={handleWithdraw}
                onCancel={handleCancel}
                loadingWithdrawId={loadingWithdrawId}
                loadingCancelId={loadingCancelId}
                refreshing={refreshing}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-xl mx-auto text-center p-8">
            <div className="w-16 h-16 bg-black text-[#FF5A00] flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-6">
              <Flame size={32} className="stroke-[2]" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-black mb-4">
              Connect to Stream Funds
            </h2>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider max-w-sm mb-8 leading-relaxed">
              Connect your Freighter browser wallet to initiate, monitor, and claim vesting payment streams in real time.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-black bg-[#FF5A00] hover:bg-black hover:text-[#FF5A00] text-black font-black uppercase tracking-widest text-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {connecting ? 'Initializing connection...' : 'Unlock Vault'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
