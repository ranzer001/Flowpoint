'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Power, ShieldAlert } from 'lucide-react';
import { StreamInfo } from '../lib/stellar';

interface StreamCardProps {
  stream: StreamInfo;
  currentUserAddress: string;
  onWithdraw: (streamId: number) => Promise<void>;
  onCancel: (streamId: number) => Promise<void>;
  loadingWithdraw: boolean;
  loadingCancel: boolean;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  currentUserAddress,
  onWithdraw,
  onCancel,
  loadingWithdraw,
  loadingCancel,
}) => {
  const isSender = currentUserAddress.toLowerCase() === stream.sender.toLowerCase();
  const isRecipient = currentUserAddress.toLowerCase() === stream.recipient.toLowerCase();

  const [liveVested, setLiveVested] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateTicker = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, now - stream.startTime);
      
      let vested = 0;
      if (elapsed >= stream.duration) {
        vested = stream.deposit;
      } else {
        vested = (stream.deposit * elapsed) / stream.duration;
      }
      
      setLiveVested(vested);
      setProgress(Math.min(100, (elapsed / stream.duration) * 100));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 100); // Update every 100ms for smooth live updates

    return () => clearInterval(interval);
  }, [stream]);

  const withdrawable = Math.max(0, liveVested - stream.withdrawn);
  const isFullyVested = progress >= 100;
  const isCompleted = stream.withdrawn >= stream.deposit;

  return (
    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between h-full">
      {/* Top Header info */}
      <div className="p-5 border-b-2 border-black bg-[#F8F9FA] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 border border-black bg-black text-[#FF5A00] font-mono text-[10px] font-black uppercase">
            ID: #{stream.id}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">
            {isSender ? 'Sent Stream' : isRecipient ? 'Received Stream' : 'Vesting Stream'}
          </span>
        </div>
        <div>
          {isSender ? (
            <ArrowUpRight size={16} className="text-[#FF5A00] stroke-[2.5]" />
          ) : (
            <ArrowDownLeft size={16} className="text-emerald-500 stroke-[2.5]" />
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-4 flex-grow">
        {/* Addresses */}
        <div className="space-y-1 bg-[#F8F9FA] p-3 border border-black font-mono text-[10px] text-gray-500">
          <div className="flex justify-between">
            <span className="font-bold uppercase tracking-wide">From:</span>
            <span className="text-black">{stream.sender.slice(0, 8)}...{stream.sender.slice(-8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold uppercase tracking-wide">To:</span>
            <span className="text-black">{stream.recipient.slice(0, 8)}...{stream.recipient.slice(-8)}</span>
          </div>
        </div>

        {/* Hero Vesting Ticker */}
        <div className="text-center py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 font-bold mb-1">
            Vested / Total
          </p>
          <div className="flex items-baseline justify-center gap-1 font-mono">
            <span className="text-3xl font-black tabular-nums text-black tracking-tight">
              {liveVested.toFixed(4)}
            </span>
            <span className="text-xs font-bold text-gray-500">/ {stream.deposit.toFixed(0)} XLM</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[10px] font-bold uppercase">
            <span className="text-gray-500">Progress</span>
            <span className="text-black">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 border-2 border-black bg-gray-100 p-0.5">
            <div 
              className="h-full bg-[#FF5A00] border-r border-black transition-all duration-100 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Withdrawal State Info */}
        <div className="p-3 border border-dashed border-black bg-[#FFFDF5] font-mono text-xs space-y-1 text-black">
          <div className="flex justify-between">
            <span className="text-gray-500 font-bold uppercase">Withdrawn:</span>
            <span className="font-bold">{stream.withdrawn.toFixed(2)} XLM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-bold uppercase">Withdrawable:</span>
            <span className="font-bold text-[#FF5A00]">{withdrawable.toFixed(4)} XLM</span>
          </div>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="p-5 border-t-2 border-black bg-[#F8F9FA] flex gap-3">
        {isRecipient ? (
          <button
            onClick={() => onWithdraw(stream.id)}
            disabled={loadingWithdraw || withdrawable <= 0 || isCompleted}
            className="flex-grow flex items-center justify-center gap-2 py-2.5 border-2 border-black bg-black text-white font-bold uppercase tracking-wider text-xs hover:bg-[#FF5A00] hover:text-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingWithdraw ? 'Withdrawing...' : isCompleted ? 'Completed' : `Withdraw ${withdrawable.toFixed(2)} XLM`}
          </button>
        ) : (
          <div className="flex-grow flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-gray-400 bg-gray-50 font-mono text-[10px] text-gray-500 font-bold uppercase">
            <ShieldAlert size={12} />
            Recipient Only
          </div>
        )}

        {isSender && !isFullyVested && !isCompleted && (
          <button
            onClick={() => onCancel(stream.id)}
            disabled={loadingCancel}
            title="Cancel Stream"
            className="p-2.5 border-2 border-black bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
          >
            <Power size={14} className="stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
