'use client';

import { useState, useEffect } from 'react';
import HomePage from "./components/HomePage";
import UltimateTicTacToe from "./components/UltimateTicTacToe";
import WaitingRoom from "./components/WaitingRoom";

type GameMode = 'solo' | 'multi-offline' | 'multi-online';
type AIDifficulty = 'easy' | 'medium' | 'hard';

interface GameState {
  mode: GameMode;
  roomId?: string;
  password?: string;
  player?: 'X' | 'O';
  isWaiting?: boolean;
  isHost?: boolean;
  aiDifficulty?: AIDifficulty;
  opponentLeft?: boolean;  // Track if opponent left during game
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
    // First try to join an existing room
    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Successfully joined as the second player (O)
        setGameState({
          mode: 'multi-online',
          roomId,
          password,
          player: 'O',
          isWaiting: true,
          isHost: false
        });
        return;
      }
    } catch (e) {
      // ignore errors and fall back to creating a new room
    }

    // If joining failed (room not found or other error), create a new room and become host
    try {
      const createRes = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const createData = await createRes.json();
      if (createRes.ok && createData.roomId) {
        // Update URL to reflect the newly created room
        const newUrl = `${window.location.origin}?room=${createData.roomId}${password ? `&pwd=${encodeURIComponent(password)}` : ''}`;
        window.history.replaceState({}, '', newUrl);
        setGameState({
          mode: 'multi-online',
          roomId: createData.roomId,
          password,
          player: 'X',
          isWaiting: true,
          isHost: true
        });
      } else {
        alert('Failed to create room');
      }
    } catch (e) {
      alert('Failed to create room');
    }
  };

  const handleStartGame = (mode: GameMode, params?: { roomId?: string; password?: string; player?: 'X' | 'O'; aiDifficulty?: AIDifficulty }) => {
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

  const handleOpponentLeft = () => {
    if (gameState) {
      // Return to waiting room with opponentLeft flag
      setGameState({
        ...gameState,
        isWaiting: true,
        opponentLeft: true
      });
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
        opponentLeft={gameState.opponentLeft}
        myPlayer={gameState.player}
      />
    );
  }

  return (
    <UltimateTicTacToe
      gameMode={gameState.mode}
      onBackToHome={handleBackToHome}
      onOpponentLeft={handleOpponentLeft}
      roomId={gameState.roomId}
      password={gameState.password}
      initialPlayer={gameState.player}
      aiDifficulty={gameState.aiDifficulty}
    />
  );
}
