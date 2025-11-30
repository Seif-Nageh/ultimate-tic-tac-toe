'use client';

import React from 'react';

type GameMode = 'solo' | 'multi-offline' | 'multi-online';

interface HomePageProps {
  onStartGame: (mode: GameMode) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStartGame }) => {
  const [showMultiplayerOptions, setShowMultiplayerOptions] = React.useState(false);
  const [showHowToPlay, setShowHowToPlay] = React.useState(false);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 overflow-hidden relative flex items-center justify-center">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px),
                           repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,0.03) 50px, rgba(255,255,255,0.03) 51px)`
        }}></div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
        {/* Title */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white mb-2 sm:mb-4 drop-shadow-2xl">
            Ultimate
          </h1>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-4 sm:mb-6 drop-shadow-2xl">
            Tic-Tac-Toe
          </h2>
          <p className="text-sm sm:text-lg text-white/80 font-medium">
            Choose your game mode to begin
          </p>
        </div>

        {/* Menu Options */}
        {!showMultiplayerOptions ? (
          <div className="space-y-3 sm:space-y-4">
            {/* Solo Play Button */}
            <button
              onClick={() => onStartGame('solo')}
              className="w-full bg-white/20 backdrop-blur-md hover:bg-white/30 active:bg-white/40 border-2 border-white/40 hover:border-white/60 rounded-2xl p-4 sm:p-8 transition-all duration-300 transform hover:scale-105 active:scale-100 hover:shadow-2xl group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <h3 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 group-hover:text-blue-200 transition-colors">
                    Solo Play
                  </h3>
                  <p className="text-white/70 text-xs sm:text-sm">
                    Play against the computer
                  </p>
                </div>
                <div className="text-4xl sm:text-6xl flex-shrink-0">🎮</div>
              </div>
            </button>

            {/* Multiplayer Button */}
            <button
              onClick={() => setShowMultiplayerOptions(true)}
              className="w-full bg-white/20 backdrop-blur-md hover:bg-white/30 active:bg-white/40 border-2 border-white/40 hover:border-white/60 rounded-2xl p-4 sm:p-8 transition-all duration-300 transform hover:scale-105 active:scale-100 hover:shadow-2xl group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <h3 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 group-hover:text-pink-200 transition-colors">
                    Multiplayer
                  </h3>
                  <p className="text-white/70 text-xs sm:text-sm">
                    Challenge a friend locally or online
                  </p>
                </div>
                <div className="text-4xl sm:text-6xl flex-shrink-0">👥</div>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back Button */}
            <button
              onClick={() => setShowMultiplayerOptions(false)}
              className="mb-4 text-white/80 hover:text-white flex items-center gap-2 transition-colors"
            >
              <span className="text-2xl">←</span>
              <span className="text-lg font-semibold">Back</span>
            </button>

            {/* Offline Multiplayer */}
            <button
              onClick={() => onStartGame('multi-offline')}
              className="w-full bg-white/20 backdrop-blur-md hover:bg-white/30 border-2 border-white/40 hover:border-white/60 rounded-2xl p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl group"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-green-200 transition-colors">
                    Local Game
                  </h3>
                  <p className="text-white/70 text-sm">
                    Play with a friend on the same device
                  </p>
                </div>
                <div className="text-6xl">🏠</div>
              </div>
            </button>

            {/* Online Multiplayer - Coming Soon */}
            <div className="w-full bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-2xl p-8 relative overflow-hidden">
              {/* Coming Soon Badge */}
              <div className="absolute top-4 right-4 bg-yellow-400/90 text-purple-900 px-4 py-1 rounded-full text-sm font-bold">
                Coming Soon
              </div>

              <div className="flex items-center justify-between opacity-60">
                <div className="text-left">
                  <h3 className="text-3xl font-bold text-white mb-2">
                    Online Game
                  </h3>
                  <p className="text-white/70 text-sm">
                    Play with friends anywhere in the world
                  </p>
                </div>
                <div className="text-6xl">🌐</div>
              </div>

              {/* Lock Icon Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <div className="text-7xl opacity-50">🔒</div>
              </div>
            </div>
          </div>
        )}

        {/* How to Play Section */}
        <div className="mt-8 sm:mt-12">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="w-full bg-white/10 backdrop-blur-md hover:bg-white/20 border-2 border-white/30 hover:border-white/50 rounded-xl p-4 transition-all duration-300 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">
                📖 How to Play
              </span>
              <span className="text-2xl text-white transition-transform duration-300" style={{ transform: showHowToPlay ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </div>
          </button>

          {/* How to Play Content */}
          {showHowToPlay && (
            <div className="mt-4 bg-black/30 backdrop-blur-md rounded-xl p-6 border-2 border-white/20 animate-fadeIn">
              <div className="space-y-4 text-white/90">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🎯 Game Rules</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Ultimate Tic-Tac-Toe is played on a 3×3 grid of small boards</li>
                    <li>• Each small board is a regular tic-tac-toe game</li>
                    <li>• Win 3 small boards in a row (horizontal, vertical, or diagonal) to win!</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">🎮 How to Play</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Your first move can be on any small board</li>
                    <li>• Where you play determines which board your opponent plays next</li>
                    <li>• If sent to a won/tied board, you can play anywhere</li>
                    <li>• Win a small board by getting 3 in a row on it</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-white/20">
                  <p className="text-sm text-white/70 italic">
                    💡 Tip: Think ahead! Your move determines where your opponent plays next.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
