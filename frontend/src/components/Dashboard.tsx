'use client';

import React, { useState } from 'react';
import { StreamInfo } from '../lib/stellar';
import { StreamCard } from './StreamCard';
import { Inbox, Outbox, Columns } from 'lucide-react';

interface DashboardProps {
  streams: StreamInfo[];
  currentUserAddress: string;
  onWithdraw: (streamId: number) => Promise<void>;
  onCancel: (streamId: number) => Promise<void>;
  loadingWithdrawId: number | null;
  loadingCancelId: number | null;
  refreshing: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  streams,
  currentUserAddress,
  onWithdraw,
  onCancel,
  loadingWithdrawId,
  loadingCancelId,
  refreshing,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'sent' | 'received'>('all');

  const sentStreams = streams.filter(s => s.sender.toLowerCase() === currentUserAddress.toLowerCase());
  const receivedStreams = streams.filter(s => s.recipient.toLowerCase() === currentUserAddress.toLowerCase());

  const filteredStreams = 
    activeTab === 'sent' 
      ? sentStreams 
      : activeTab === 'received' 
        ? receivedStreams 
        : streams;

  return (
    <div className="space-y-6">
      {/* Tabs / Filtering */}
      <div className="flex border-2 border-black bg-white p-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] max-w-md">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-grow flex items-center justify-center gap-1.5 py-2 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'all' ? 'bg-black text-white' : 'hover:bg-gray-100 text-black'
          }`}
        >
          <Columns size={14} />
          All ({streams.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-grow flex items-center justify-center gap-1.5 py-2 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'sent' ? 'bg-black text-white' : 'hover:bg-gray-100 text-black'
          }`}
        >
          <Inbox size={14} />
          Sent ({sentStreams.length})
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-grow flex items-center justify-center gap-1.5 py-2 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'received' ? 'bg-black text-white' : 'hover:bg-gray-100 text-black'
          }`}
        >
          <Outbox size={14} />
          Received ({receivedStreams.length})
        </button>
      </div>

      {/* Grid of Streams */}
      {refreshing && streams.length === 0 ? (
        <div className="flex items-center justify-center py-12 border-2 border-dashed border-black bg-white">
          <p className="font-mono text-xs uppercase tracking-widest text-gray-500 animate-pulse">
            Syncing streaming state...
          </p>
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-mono text-sm uppercase tracking-wider text-black font-black mb-2">
            No streams found
          </p>
          <p className="font-mono text-xs text-gray-500 max-w-xs text-center">
            {activeTab === 'all' 
              ? "You don't have any active vesting streams. Create one above to get started!"
              : activeTab === 'sent'
                ? "You haven't initiated any vesting streams yet."
                : "You aren't the recipient of any vesting streams yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStreams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              currentUserAddress={currentUserAddress}
              onWithdraw={onWithdraw}
              onCancel={onCancel}
              loadingWithdraw={loadingWithdrawId === stream.id}
              loadingCancel={loadingCancelId === stream.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
