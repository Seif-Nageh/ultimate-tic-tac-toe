'use client';

import { useState, useEffect } from 'react';
import HomePage from "./components/HomePage";
import UltimateTicTacToe from "./components/UltimateTicTacToe";
import WaitingRoom from "./components/WaitingRoom";

type GameMode = 'solo' | 'multi-offline' | 'multi-online';

interface GameState {
  mode: GameMode;
  roomId?: string;
  password?: string;
  player?: 'X' | 'O';
  isWaiting?: boolean;
  isHost?: boolean;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Check URL for room parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get('room');
      const password = params.get('pwd');

      if (roomId) {
        // Auto-join room from URL
        handleJoinFromUrl(roomId, password || '');
      }
    }
  }, []);

  const handleJoinFromUrl = async (roomId: string, password: string) => {
    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, password })
      });
      const data = await res.json();
      if (data.success) {
        setGameState({ 
          mode: 'multi-online', 
          roomId, 
          password, 
          player: 'O',
          isWaiting: true,
          isHost: false
        });
      } else {
        alert(data.error || 'Failed to join room');
      }
    } catch (e) {
      alert('Failed to join room');
    }
  };

  const handleStartGame = (mode: GameMode, params?: { roomId?: string; password?: string; player?: 'X' | 'O' }) => {
    if (mode === 'multi-online' && params?.roomId) {
      // Start in waiting room for online games
      setGameState({ 
        mode, 
        ...params, 
        isWaiting: true,
        isHost: params.player === 'X'
      });
    } else {
      setGameState({ mode, ...params });
    }
  };

  const handleGameStart = () => {
    if (gameState) {
      setGameState({ ...gameState, isWaiting: false });
    }
  };

  const handleBackToHome = () => {
    setGameState(null);
    // Clear URL parameters
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  if (gameState === null) {
    return <HomePage onStartGame={handleStartGame} />;
  }

  // Show waiting room for online games
  if (gameState.mode === 'multi-online' && gameState.isWaiting) {
    return (
      <WaitingRoom
        roomId={gameState.roomId!}
        password={gameState.password}
        isHost={gameState.isHost || false}
        onGameStart={handleGameStart}
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <UltimateTicTacToe 
      gameMode={gameState.mode} 
      onBackToHome={handleBackToHome}
      roomId={gameState.roomId}
      password={gameState.password}
      initialPlayer={gameState.player}
    />
  );
}
