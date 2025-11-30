'use client';

import { useState } from 'react';
import HomePage from "./components/HomePage";
import UltimateTicTacToe from "./components/UltimateTicTacToe";

type GameMode = 'solo' | 'multi-offline' | 'multi-online' | null;

export default function Home() {
  const [gameMode, setGameMode] = useState<GameMode>(null);

  const handleStartGame = (mode: GameMode) => {
    setGameMode(mode);
  };

  const handleBackToHome = () => {
    setGameMode(null);
  };

  if (gameMode === null) {
    return <HomePage onStartGame={handleStartGame} />;
  }

  return <UltimateTicTacToe gameMode={gameMode} onBackToHome={handleBackToHome} />;
}
