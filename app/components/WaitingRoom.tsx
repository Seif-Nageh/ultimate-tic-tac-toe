'use client';

import React, { useState, useEffect } from 'react';

interface WaitingRoomProps {
  roomId: string;
  password?: string;
  isHost: boolean;
  onGameStart: () => void;
  onBackToHome: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, password, isHost, onGameStart, onBackToHome }) => {
  const [copied, setCopied] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}?room=${roomId}${password ? `&pwd=${encodeURIComponent(password)}` : ''}`
    : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Poll for player 2 joining
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game/${roomId}`);
        const data = await res.json();
        if (data && data.players) {
          const count = (data.players.X === 'connected' ? 1 : 0) + (data.players.O === 'connected' ? 1 : 0);
          setPlayerCount(count);
          if (count === 2) {
            onGameStart();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId, onGameStart]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 overflow-y-auto relative flex items-center justify-center py-8">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px),
                           repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px)`
        }}></div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 w-full">
        {/* Back Button */}
        <button
          onClick={onBackToHome}
          className="mb-6 text-white/80 hover:text-white flex items-center gap-2 transition-colors"
        >
          <span className="text-2xl">←</span>
          <span className="text-lg font-semibold">Back to Home</span>
        </button>

        {/* Waiting Room Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              {isHost ? '🎮 Room Created!' : '🎮 Joined Room!'}
            </h1>
            <p className="text-white/70 text-sm sm:text-base">
              {playerCount === 2 ? 'Starting game...' : 'Waiting for opponent...'}
            </p>
          </div>

          {/* Room Info */}
          <div className="bg-black/30 rounded-xl p-6 mb-6">
            <div className="text-center mb-4">
              <p className="text-white/60 text-sm mb-2">Room ID</p>
              <p className="text-4xl sm:text-5xl font-black text-white tracking-wider font-mono">
                {roomId}
              </p>
            </div>
            
            {password && (
              <div className="text-center pt-4 border-t border-white/10">
                <p className="text-white/60 text-sm mb-1">Password</p>
                <p className="text-xl font-semibold text-white">
                  {password}
                </p>
              </div>
            )}
          </div>

          {/* Player Status */}
          <div className="bg-black/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl">👤</span>
                </div>
                <p className="text-white font-semibold">Player 1</p>
                <p className="text-green-400 text-sm">✓ Connected</p>
              </div>
              
              <div className="text-white/40 text-3xl">VS</div>
              
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 mx-auto ${
                  playerCount === 2 ? 'bg-pink-500' : 'bg-white/10 border-2 border-dashed border-white/30'
                }`}>
                  <span className="text-2xl">{playerCount === 2 ? '👤' : '?'}</span>
                </div>
                <p className="text-white font-semibold">Player 2</p>
                <p className={playerCount === 2 ? 'text-green-400 text-sm' : 'text-yellow-400 text-sm'}>
                  {playerCount === 2 ? '✓ Connected' : '⏳ Waiting...'}
                </p>
              </div>
            </div>
          </div>

          {/* Share Link (only for host) */}
          {isHost && (
            <div className="space-y-3">
              <p className="text-white font-semibold text-center mb-2">
                📤 Share this link with your friend:
              </p>
              
              <div className="bg-black/30 rounded-lg p-3 flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm outline-none select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold text-sm transition"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              <div className="text-center text-white/60 text-xs">
                Or share the Room ID: <span className="font-mono font-bold text-white">{roomId}</span>
                {password && <span> with password: <span className="font-bold text-white">{password}</span></span>}
              </div>
            </div>
          )}

          {/* Loading Animation */}
          {playerCount < 2 && (
            <div className="mt-6 flex justify-center">
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
