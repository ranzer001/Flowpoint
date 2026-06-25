'use client';

import React, { useState } from 'react';
import { Send, Clock, DollarSign, User, RefreshCw } from 'lucide-react';
import { StrKey } from '@stellar/stellar-sdk';

interface CreateStreamFormProps {
  balance: number;
  onSubmit: (recipient: string, amount: number, duration: number) => Promise<void>;
  loading: boolean;
}

export const CreateStreamForm: React.FC<CreateStreamFormProps> = ({
  balance,
  onSubmit,
  loading,
}) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('120'); // Default 120 seconds for fast demo
  const [error, setError] = useState('');

  const ratePerSecond = 
    amount && duration && Number(duration) > 0 
      ? (Number(amount) / Number(duration)).toFixed(4)
      : '0.0000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!recipient) {
      setError('Recipient address is required.');
      return;
    }
    
    // Validate Stellar public key format
    if (!StrKey.isValidEd25519PublicKey(recipient) && !recipient.startsWith('C')) {
      setError('Invalid recipient Stellar address (must start with G or C).');
      return;
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    if (numAmount > balance) {
      setError(`Insufficient SV token balance. You have ${balance} SV.`);
      return;
    }

    const numDuration = Number(duration);
    if (!duration || isNaN(numDuration) || numDuration <= 0) {
      setError('Duration must be greater than 0.');
      return;
    }

    try {
      await onSubmit(recipient, numAmount, numDuration);
      setRecipient('');
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit transaction.');
    }
  };

  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-dashed border-black">
        <Send size={18} className="text-[#FF5A00]" />
        <h2 className="text-lg font-black uppercase tracking-tight text-black">
          Initiate Vesting Stream
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 border-2 border-black bg-rose-50 text-rose-700 font-mono text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mb-1">
            Recipient Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black">
              <User size={16} />
            </div>
            <input
              type="text"
              placeholder="G... or C..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={loading}
              className="block w-full pl-9 pr-3 py-2.5 border-2 border-black bg-[#F8F9FA] focus:bg-white text-black font-mono text-xs outline-none focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mb-1">
              Deposit Amount (SV)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black">
                <DollarSign size={16} />
              </div>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="block w-full pl-9 pr-3 py-2.5 border-2 border-black bg-[#F8F9FA] focus:bg-white text-black font-mono text-xs outline-none focus:ring-0 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mb-1">
              Stream Duration (Seconds)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black">
                <Clock size={16} />
              </div>
              <input
                type="number"
                placeholder="120"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={loading}
                className="block w-full pl-9 pr-3 py-2.5 border-2 border-black bg-[#F8F9FA] focus:bg-white text-black font-mono text-xs outline-none focus:ring-0 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border border-black bg-[#F8F9FA] font-mono text-xs space-y-1.5 text-black">
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase tracking-wider font-bold">Vesting Rate:</span>
            <span className="font-bold text-black">{ratePerSecond} SV / sec</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase tracking-wider font-bold">Vesting Style:</span>
            <span className="font-bold uppercase text-[#FF5A00]">Linear Vesting</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-black bg-black text-white font-black uppercase tracking-widest text-xs hover:bg-[#FF5A00] hover:text-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Creating stream...
            </>
          ) : (
            <>
              <Send size={14} className="stroke-[2.5]" />
              Start Stream
            </>
          )}
        </button>
      </form>
    </div>
  );
};
