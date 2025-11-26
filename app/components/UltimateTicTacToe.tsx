'use client';

import React, { useState, useRef, useEffect } from 'react';

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardWinner = Player | 'DRAW' | null;

const UltimateTicTacToe = () => {
  // Game state: 9 boards, each with 9 cells
  const [boards, setBoards] = useState<CellValue[][]>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [boardWinners, setBoardWinners] = useState<BoardWinner[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [activeBoard, setActiveBoard] = useState<number | null>(null); // null means any board
  const [gameWinner, setGameWinner] = useState<BoardWinner>(null);

  // Zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  // Check if a small board has a winner
  const checkBoardWinner = (board: CellValue[]): BoardWinner => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] as Player;
      }
    }

    // Check for draw
    if (board.every(cell => cell !== null)) {
      return 'DRAW';
    }

    return null;
  };

  // Check if game has overall winner
  const checkGameWinner = (winners: BoardWinner[]): BoardWinner => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (winners[a] && winners[a] !== 'DRAW' &&
          winners[a] === winners[b] && winners[a] === winners[c]) {
        return winners[a];
      }
    }
    return null;
  };

  // Handle cell click
  const handleCellClick = (boardIndex: number, cellIndex: number) => {
    if (gameWinner) return;
    if (boardWinners[boardIndex]) return; // Board already won
    if (boards[boardIndex][cellIndex]) return; // Cell already taken
    if (activeBoard !== null && activeBoard !== boardIndex) return; // Wrong board

    // Make move
    const newBoards = boards.map((board, i) =>
      i === boardIndex ? board.map((cell, j) => j === cellIndex ? currentPlayer : cell) : board
    );
    setBoards(newBoards);

    // Check if this move won the small board
    const newBoardWinners = [...boardWinners];
    const winner = checkBoardWinner(newBoards[boardIndex]);
    if (winner) {
      newBoardWinners[boardIndex] = winner;
      setBoardWinners(newBoardWinners);

      // Check if game is won
      const gameWinner = checkGameWinner(newBoardWinners);
      if (gameWinner) {
        setGameWinner(gameWinner);
      }

      // NEW RULE: If current player wins a board, opponent can play anywhere
      setActiveBoard(null);
    } else {
      // Determine next active board based on cell position
      const nextBoard = cellIndex;
      if (newBoardWinners[nextBoard]) {
        setActiveBoard(null); // Next player can play anywhere if sent to won board
      } else {
        setActiveBoard(nextBoard);
      }
    }

    // Switch player
    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
  };

  // Reset game
  const resetGame = () => {
    setBoards(Array(9).fill(null).map(() => Array(9).fill(null)));
    setBoardWinners(Array(9).fill(null));
    setCurrentPlayer('X');
    setActiveBoard(null);
    setGameWinner(null);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + delta), 3);
    setScale(newScale);
  };

  // Touch handlers for pinch zoom
  const getTouchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const delta = distance - lastTouchDistance;
        const newScale = Math.min(Math.max(0.5, scale + delta * 0.01), 3);
        setScale(newScale);
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-black/30 backdrop-blur-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Ultimate Tic-Tac-Toe</h1>
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-white text-purple-900 rounded-lg font-semibold hover:bg-purple-100 transition"
          >
            New Game
          </button>
        </div>
      </div>

      {/* Game Info */}
      <div className="absolute top-20 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-black/40 backdrop-blur-md rounded-lg p-4 inline-block pointer-events-auto">
            {gameWinner ? (
              <div className="text-2xl font-bold text-white">
                🎉 {gameWinner === 'DRAW' ? "It's a Draw!" : `Player ${gameWinner} Wins!`}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-xl font-semibold text-white">
                  Current Player: <span className={currentPlayer === 'X' ? 'text-blue-400' : 'text-pink-400'}>{currentPlayer}</span>
                </div>
                <div className="text-sm text-gray-300">
                  {activeBoard === null ? '🎯 Play anywhere!' : `🎯 Play in board ${activeBoard + 1}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setScale(Math.min(3, scale + 0.2))}
          className="w-12 h-12 bg-white/90 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold hover:bg-white transition"
        >
          +
        </button>
        <button
          onClick={() => setScale(Math.max(0.5, scale - 0.2))}
          className="w-12 h-12 bg-white/90 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold hover:bg-white transition"
        >
          −
        </button>
        <button
          onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
          className="w-12 h-12 bg-white/90 rounded-full shadow-lg flex items-center justify-center text-sm font-bold hover:bg-white transition"
        >
          ⟲
        </button>
      </div>

      {/* Game Board Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 pt-32 pb-8 overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="flex items-center justify-center h-full transition-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
          {/* Main Game Board */}
          <div className="inline-block p-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-3">
              {boards.map((board, boardIndex) => {
                const isActive = activeBoard === null || activeBoard === boardIndex;
                const winner = boardWinners[boardIndex];

                return (
                  <div
                    key={boardIndex}
                    className={`relative bg-white/20 rounded-lg p-2 transition-all ${
                      isActive && !winner ? 'ring-4 ring-yellow-400 shadow-xl shadow-yellow-400/50' : ''
                    } ${!isActive && !winner ? 'opacity-50' : ''}`}
                  >
                    {/* Small Board Winner Overlay */}
                    {winner && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 backdrop-blur-sm">
                        <span className={`text-6xl font-bold ${
                          winner === 'X' ? 'text-blue-400' :
                          winner === 'O' ? 'text-pink-400' :
                          'text-gray-400'
                        }`}>
                          {winner === 'DRAW' ? '−' : winner}
                        </span>
                      </div>
                    )}

                    {/* 3x3 cells */}
                    <div className="grid grid-cols-3 gap-1">
                      {board.map((cell, cellIndex) => (
                        <button
                          key={cellIndex}
                          onClick={() => handleCellClick(boardIndex, cellIndex)}
                          disabled={!isActive || !!winner || !!gameWinner}
                          className={`w-12 h-12 md:w-16 md:h-16 bg-white/30 rounded flex items-center justify-center transition-all ${
                            !winner && isActive && !cell ? 'hover:bg-white/50 active:scale-95' : ''
                          } ${!isActive || winner ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {cell && (
                            <span className={`text-4xl md:text-5xl font-black drop-shadow-lg ${
                              cell === 'X' ? 'text-blue-400' : 'text-pink-400'
                            }`}>
                              {cell}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-20 max-w-xs">
        <div className="bg-black/40 backdrop-blur-md rounded-lg p-3 text-white text-xs">
          <p className="font-semibold mb-1">🎮 How to Play:</p>
          <ul className="space-y-1 text-gray-300">
            <li>• Win 3 small boards in a row to win</li>
            <li>• Your move determines opponent&apos;s next board</li>
            <li>• Win a board? Opponent plays anywhere! 🎯</li>
            <li>• 📱 Pinch to zoom | 🖱️ Scroll to zoom</li>
            <li>• Drag to pan the board</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UltimateTicTacToe;
