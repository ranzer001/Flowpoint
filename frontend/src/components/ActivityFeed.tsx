'use client';

import React from 'react';
import { ListTodo, CheckCircle, Flame, Gift } from 'lucide-react';

export interface ActivityEvent {
  id: string;
  type: 'created' | 'withdrawn' | 'cancelled';
  streamId: number;
  amount: number;
  timestamp: number;
  txHash: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-dashed border-black">
        <ListTodo size={18} className="text-[#FF5A00]" />
        <h2 className="text-lg font-black uppercase tracking-tight text-black">
          Activity Feed
        </h2>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest">
          No recent activity
        </div>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
          {events.map((event) => {
            const dateStr = new Date(event.timestamp * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div 
                key={event.id} 
                className="flex items-start gap-3 p-3 border border-black bg-[#F8F9FA] hover:bg-white transition-colors"
              >
                <div className="mt-0.5">
                  {event.type === 'created' && (
                    <div className="p-1.5 bg-black text-[#FF5A00] border border-black">
                      <Gift size={12} className="stroke-[2.5]" />
                    </div>
                  )}
                  {event.type === 'withdrawn' && (
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 border border-emerald-500">
                      <CheckCircle size={12} className="stroke-[2.5]" />
                    </div>
                  )}
                  {event.type === 'cancelled' && (
                    <div className="p-1.5 bg-rose-100 text-rose-700 border border-rose-500">
                      <Flame size={12} className="stroke-[2.5]" />
                    </div>
                  )}
                </div>

                <div className="flex-grow space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] font-bold text-gray-500 uppercase">
                      Stream #{event.streamId}
                    </span>
                    <span className="font-mono text-[9px] text-gray-400">
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-xs text-black font-semibold font-mono">
                    {event.type === 'created' && `Stream created with ${event.amount} SV`}
                    {event.type === 'withdrawn' && `Withdrew ${event.amount.toFixed(2)} SV`}
                    {event.type === 'cancelled' && `Stream cancelled (${event.amount.toFixed(2)} SV returned)`}
                  </p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-mono text-[9px] text-[#FF5A00] hover:underline font-bold"
                  >
                    View Tx ({event.txHash.slice(0, 8)}...)
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
