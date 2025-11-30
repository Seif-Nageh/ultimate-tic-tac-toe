'use client';

import React, { useState, useRef, useEffect } from 'react';

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardWinner = Player | 'DRAW' | null;
type GameMode = 'solo' | 'multi-offline' | 'multi-online';

interface UltimateTicTacToeProps {
  gameMode: GameMode;
  onBackToHome: () => void;
  roomId?: string;
  password?: string;
  initialPlayer?: Player;
}

const UltimateTicTacToe: React.FC<UltimateTicTacToeProps> = ({ gameMode, onBackToHome, roomId, initialPlayer }) => {
  // Game state: 9 boards, each with 9 cells
  const [boards, setBoards] = useState<CellValue[][]>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [boardWinners, setBoardWinners] = useState<BoardWinner[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [activeBoard, setActiveBoard] = useState<number | null>(null); // null means any board
  const [gameWinner, setGameWinner] = useState<BoardWinner>(null);
  const [myPlayer] = useState<Player>(initialPlayer || 'X'); // For online mode

  // Zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showZoomControls, setShowZoomControls] = useState(false);
  const isAIMoveRef = useRef(false);
  
  // Rematch state for online mode
  const [rematchRequests, setRematchRequests] = useState({ X: false, O: false });
  const [showRematchNotification, setShowRematchNotification] = useState(false);

  // Polling for online game state
  useEffect(() => {
    if (gameMode === 'multi-online' && roomId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/game/${roomId}`);
          const data = await res.json();
          if (data && !data.error) {
            setBoards(data.boards);
            setBoardWinners(data.boardWinners);
            setCurrentPlayer(data.currentPlayer);
            setActiveBoard(data.activeBoard);
            setGameWinner(data.gameWinner);
            
            // Check for rematch requests
            if (data.rematchRequests) {
              setRematchRequests(data.rematchRequests);
              
              // If both players requested rematch, reset the game
              if (data.rematchRequests.X && data.rematchRequests.O) {
                // Game will be reset by the server, just update local state
                setShowRematchNotification(false);
              } else if (data.rematchRequests[myPlayer === 'X' ? 'O' : 'X']) {
                // Opponent requested rematch
                setShowRematchNotification(true);
              }
            }
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 1000); // Poll every 1 second

      return () => clearInterval(interval);
    }
  }, [gameMode, roomId, myPlayer]);

  // Sync state to server
  const syncState = async (newState: any) => {
    if (gameMode === 'multi-online' && roomId) {
      try {
        await fetch(`/api/game/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newState)
        });
      } catch (e) {
        console.error('Sync error:', e);
      }
    }
  };

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

  // AI Logic for Solo Mode
  const getAIMove = (): { boardIndex: number; cellIndex: number } | null => {
    const availableBoards = activeBoard !== null
      ? [activeBoard]
      : boards.map((_, i) => i).filter(i => !boardWinners[i]);

    // Strategy 1: Try to win a board
    for (const boardIdx of availableBoards) {
      const board = boards[boardIdx];
      const winningMove = findWinningMove(board, 'O');
      if (winningMove !== null) {
        return { boardIndex: boardIdx, cellIndex: winningMove };
      }
    }

    // Strategy 2: Block opponent from winning a board
    for (const boardIdx of availableBoards) {
      const board = boards[boardIdx];
      const blockingMove = findWinningMove(board, 'X');
      if (blockingMove !== null) {
        return { boardIndex: boardIdx, cellIndex: blockingMove };
      }
    }

    // Strategy 3: Try to win the overall game
    const aiWinningBoard = findWinningMove(boardWinners, 'O');
    if (aiWinningBoard !== null && availableBoards.includes(aiWinningBoard)) {
      const board = boards[aiWinningBoard];
      const emptyCells = board.map((cell, idx) => cell === null ? idx : -1).filter(idx => idx !== -1);
      if (emptyCells.length > 0) {
        return { boardIndex: aiWinningBoard, cellIndex: emptyCells[0] };
      }
    }

    // Strategy 4: Block opponent from winning the overall game
    const blockGameBoard = findWinningMove(boardWinners, 'X');
    if (blockGameBoard !== null && availableBoards.includes(blockGameBoard)) {
      const board = boards[blockGameBoard];
      const emptyCells = board.map((cell, idx) => cell === null ? idx : -1).filter(idx => idx !== -1);
      if (emptyCells.length > 0) {
        return { boardIndex: blockGameBoard, cellIndex: emptyCells[0] };
      }
    }

    // Strategy 5: Take center of a board if available
    for (const boardIdx of availableBoards) {
      if (boards[boardIdx][4] === null) {
        return { boardIndex: boardIdx, cellIndex: 4 };
      }
    }

    // Strategy 6: Take corners
    const corners = [0, 2, 6, 8];
    for (const boardIdx of availableBoards) {
      const board = boards[boardIdx];
      for (const corner of corners) {
        if (board[corner] === null) {
          return { boardIndex: boardIdx, cellIndex: corner };
        }
      }
    }

    // Strategy 7: Take any available cell
    for (const boardIdx of availableBoards) {
      const board = boards[boardIdx];
      const emptyCells = board.map((cell, idx) => cell === null ? idx : -1).filter(idx => idx !== -1);
      if (emptyCells.length > 0) {
        return { boardIndex: boardIdx, cellIndex: emptyCells[0] };
      }
    }

    return null;
  };

  const findWinningMove = (cells: (CellValue | BoardWinner)[], player: Player): number | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const values = [cells[a], cells[b], cells[c]];
      const playerCount = values.filter(v => v === player).length;
      const emptyCount = values.filter(v => v === null).length;

      if (playerCount === 2 && emptyCount === 1) {
        // Found a winning/blocking position
        if (cells[a] === null) return a;
        if (cells[b] === null) return b;
        if (cells[c] === null) return c;
      }
    }

    return null;
  };

  // Trigger AI move when it's O's turn in solo mode
  useEffect(() => {
    if (gameMode === 'solo' && currentPlayer === 'O' && !gameWinner) {
      const timer = setTimeout(() => {
        const move = getAIMove();
        if (move) {
          isAIMoveRef.current = true;
          handleCellClick(move.boardIndex, move.cellIndex);
        }
      }, 300); // Quick AI response

      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameMode, gameWinner, boards, boardWinners, activeBoard]);

  // Handle cell click
  const handleCellClick = (boardIndex: number, cellIndex: number) => {
    if (gameWinner) return;
    if (boardWinners[boardIndex]) return; // Board already won
    if (boards[boardIndex][cellIndex]) return; // Cell already taken
    if (activeBoard !== null && activeBoard !== boardIndex) return; // Wrong board

    // In solo mode, prevent player from moving when it's AI's turn (but allow AI moves)
    if (gameMode === 'solo' && currentPlayer === 'O' && !isAIMoveRef.current) return;

    // In online mode, prevent moving if it's not my turn
    if (gameMode === 'multi-online' && currentPlayer !== myPlayer) return;

    // Reset AI move flag after using it
    if (isAIMoveRef.current) {
      isAIMoveRef.current = false;
    }

    // Make move
    const newBoards = boards.map((board, i) =>
      i === boardIndex ? board.map((cell, j) => j === cellIndex ? currentPlayer : cell) : board
    );
    setBoards(newBoards);

    // Check if this move won the small board
    const newBoardWinners = [...boardWinners];
    const winner = checkBoardWinner(newBoards[boardIndex]);
    let nextActiveBoard: number | null = null;

    if (winner) {
      newBoardWinners[boardIndex] = winner;
      setBoardWinners(newBoardWinners);

      // Check if game is won
      const gameWinner = checkGameWinner(newBoardWinners);
      if (gameWinner) {
        setGameWinner(gameWinner);
      }

      // NEW RULE: If current player wins a board, opponent can play anywhere
      nextActiveBoard = null;
    } else {
      // Determine next active board based on cell position
      const nextBoard = cellIndex;
      if (newBoardWinners[nextBoard]) {
        nextActiveBoard = null; // Next player can play anywhere if sent to won board
      } else {
        nextActiveBoard = nextBoard;
      }
    }
    
    setActiveBoard(nextActiveBoard);

    // Switch player
    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
    setCurrentPlayer(nextPlayer);

    // Sync with server if online
    if (gameMode === 'multi-online') {
      syncState({
        boards: newBoards,
        boardWinners: newBoardWinners,
        currentPlayer: nextPlayer,
        activeBoard: nextActiveBoard,
        gameWinner: winner ? checkGameWinner(newBoardWinners) : null,
        players: { X: 'connected', O: 'connected' } // Keep players connected
      });
    }
  };

  // Reset game / Request rematch
  const resetGame = async () => {
    if (gameMode === 'multi-online' && roomId) {
      // Request rematch
      const newRematchRequests = { ...rematchRequests, [myPlayer]: true };
      
      try {
        const res = await fetch(`/api/game/${roomId}`);
        const data = await res.json();
        
        // Check if opponent already requested
        const opponentPlayer = myPlayer === 'X' ? 'O' : 'X';
        const opponentRequested = data.rematchRequests?.[opponentPlayer] || false;
        
        if (opponentRequested) {
          // Both players agreed, reset the game
          const initialState = {
            boards: Array(9).fill(null).map(() => Array(9).fill(null)),
            boardWinners: Array(9).fill(null),
            currentPlayer: 'X' as Player,
            activeBoard: null,
            gameWinner: null,
            players: { X: 'connected', O: 'connected' },
            rematchRequests: { X: false, O: false }
          };
          
          await syncState(initialState);
          
          // Update local state
          setBoards(initialState.boards);
          setBoardWinners(initialState.boardWinners);
          setCurrentPlayer('X');
          setActiveBoard(null);
          setGameWinner(null);
          setRematchRequests({ X: false, O: false });
          setShowRematchNotification(false);
        } else {
          // Just send my rematch request
          await syncState({
            ...data,
            rematchRequests: newRematchRequests
          });
          setRematchRequests(newRematchRequests);
        }
      } catch (e) {
        console.error('Rematch error:', e);
      }
    } else {
      // Local/Solo mode - reset immediately
      const initialState = {
        boards: Array(9).fill(null).map(() => Array(9).fill(null)),
        boardWinners: Array(9).fill(null),
        currentPlayer: 'X' as Player,
        activeBoard: null,
        gameWinner: null,
      };

      setBoards(initialState.boards);
      setBoardWinners(initialState.boardWinners);
      setCurrentPlayer('X');
      setActiveBoard(null);
      setGameWinner(null);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Reject rematch
  const rejectRematch = async () => {
    if (gameMode === 'multi-online' && roomId) {
      try {
        const res = await fetch(`/api/game/${roomId}`);
        const data = await res.json();
        
        // Clear all rematch requests
        await syncState({
          ...data,
          rematchRequests: { X: false, O: false }
        });
        
        setRematchRequests({ X: false, O: false });
        setShowRematchNotification(false);
      } catch (e) {
        console.error('Reject rematch error:', e);
      }
    }
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + delta), 3);
    setScale(newScale);
  };

  // Touch handlers for pinch zoom
  const getTouchDistance = (touches: React.TouchList) => {
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
      <div className="absolute top-0 left-0 right-0 z-20 bg-black/30 backdrop-blur-md p-2 sm:p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={onBackToHome}
              className="text-white/80 hover:text-white flex items-center transition-colors flex-shrink-0"
              title="Back to Home"
            >
              <span className="text-xl sm:text-2xl">←</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white truncate">Ultimate Tic-Tac-Toe</h1>
              <p className="text-[10px] sm:text-xs text-white/60 truncate">
                {gameMode === 'solo' ? '🎮 Solo Play' : gameMode === 'multi-offline' ? '🏠 Local Multiplayer' : '🌐 Online Multiplayer'}
              </p>
            </div>
          </div>
          
          {/* Rematch Buttons */}
          {gameMode === 'multi-online' && showRematchNotification && !rematchRequests[myPlayer] ? (
            // Show Accept/Reject when opponent requested
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={resetGame}
                className="px-2 py-1 sm:px-4 sm:py-2 bg-green-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-green-600 transition"
              >
                <span className="hidden sm:inline">✓ Accept</span>
                <span className="sm:hidden">✓</span>
              </button>
              <button
                onClick={rejectRematch}
                className="px-2 py-1 sm:px-4 sm:py-2 bg-red-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-red-600 transition"
              >
                <span className="hidden sm:inline">✗ Reject</span>
                <span className="sm:hidden">✗</span>
              </button>
            </div>
          ) : (
            // Normal button
            <button
              onClick={resetGame}
              className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-semibold transition flex-shrink-0 ${
                gameMode === 'multi-online' && rematchRequests[myPlayer]
                  ? 'bg-yellow-400 text-purple-900 hover:bg-yellow-300'
                  : 'bg-white text-purple-900 hover:bg-purple-100'
              }`}
            >
              {gameMode === 'multi-online' ? (
                rematchRequests[myPlayer] ? (
                  <>
                    <span className="hidden sm:inline">⏳ Waiting...</span>
                    <span className="sm:hidden">⏳</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Request Rematch</span>
                    <span className="sm:hidden">Rematch</span>
                  </>
                )
              ) : (
                <>
                  <span className="hidden sm:inline">New Game</span>
                  <span className="sm:hidden">New</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="absolute top-14 sm:top-20 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="bg-black/40 backdrop-blur-md rounded-lg p-2 sm:p-4 inline-block pointer-events-auto max-w-full">
            {gameWinner ? (
              <div className="text-lg sm:text-2xl font-bold text-white">
                🎉 {gameWinner === 'DRAW' ? "It's a Draw!" : `Player ${gameWinner} Wins!`}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4">
                <div className="text-base sm:text-xl font-semibold text-white">
                  {gameMode === 'solo' ? (
                    currentPlayer === 'X' ? (
                      <>Your Turn <span className="text-blue-400">(X)</span></>
                    ) : (
                      <>Computer... <span className="text-pink-400">(O)</span></>
                    )
                  ) : (
                    <>Player: <span className={currentPlayer === 'X' ? 'text-blue-400' : 'text-pink-400'}>{currentPlayer}</span></>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-300">
                  {activeBoard === null ? '🎯 Play anywhere!' : `🎯 Board ${activeBoard + 1}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rematch Notification */}
      {gameMode === 'multi-online' && showRematchNotification && !rematchRequests[myPlayer] && (
        <div className="absolute top-32 sm:top-40 left-0 right-0 z-20 pointer-events-none">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <div className="bg-blue-500/90 backdrop-blur-md rounded-lg p-3 sm:p-4 inline-block pointer-events-auto animate-pulse">
              <div className="text-sm sm:text-base font-semibold text-white">
                🔄 Opponent wants a rematch! Click "Request Rematch" to accept.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      {/* Zoom Controls - Collapsible FAB */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        {/* Expanded Controls */}
        <div className={`flex flex-col gap-2 transition-all duration-300 origin-bottom ${
          showZoomControls ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-12 h-12 bg-white text-black rounded-full shadow-lg flex items-center justify-center font-bold text-xl hover:bg-gray-100 transition active:scale-95"
            title="How to Play"
          >
            ?
          </button>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.2))}
            className="w-12 h-12 bg-white text-black rounded-full shadow-lg flex items-center justify-center font-bold text-2xl hover:bg-gray-100 transition active:scale-95"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.2))}
            className="w-12 h-12 bg-white text-black rounded-full shadow-lg flex items-center justify-center font-bold text-2xl hover:bg-gray-100 transition active:scale-95"
            title="Zoom Out"
          >
            −
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowZoomControls(!showZoomControls)}
          className="w-14 h-14 bg-white text-black rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95 hover:bg-gray-100"
          title={showZoomControls ? "Close Menu" : "Open Menu"}
        >
          {showZoomControls ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Game Board Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 pt-28 sm:pt-36 pb-4 sm:pb-8 overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="transition-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
          {/* Main Game Board */}
          <div className="w-[90vw] h-[90vw] max-w-[600px] max-h-[600px] p-1 sm:p-1.5 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-1 sm:gap-2 w-full h-full">
              {boards.map((board, boardIndex) => {
                const isActive = activeBoard === null || activeBoard === boardIndex;
                const winner = boardWinners[boardIndex];
                
                // In online mode, only highlight if it's my turn
                const shouldHighlight = gameMode === 'multi-online' 
                  ? (isActive && !winner && currentPlayer === myPlayer)
                  : (isActive && !winner);

                return (
                  <div
                    key={boardIndex}
                    className={`relative bg-white/20 rounded-lg p-0.5 sm:p-1 transition-all ${
                      shouldHighlight ? 'ring-1 sm:ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/50' : ''
                    } ${!isActive && !winner ? 'opacity-50' : ''}`}
                  >
                    {/* Small Board Winner Overlay */}
                    {winner && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10 backdrop-blur-sm">
                        <span className={`text-[min(25vw,10rem)] leading-none font-bold ${
                          winner === 'X' ? 'text-blue-400' :
                          winner === 'O' ? 'text-pink-400' :
                          'text-gray-400'
                        }`}>
                          {winner === 'DRAW' ? '−' : winner}
                        </span>
                      </div>
                    )}

                    {/* 3x3 cells */}
                    <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                      {board.map((cell, cellIndex) => (
                        <button
                          key={cellIndex}
                          onClick={() => handleCellClick(boardIndex, cellIndex)}
                          disabled={!isActive || !!winner || !!gameWinner}
                          className={`aspect-square bg-white/30 rounded flex items-center justify-center transition-all ${
                            !winner && isActive && !cell ? 'hover:bg-white/50 active:scale-95' : ''
                          } ${!isActive || winner ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {cell && (
                            <span className={`text-[min(9vw,3.5rem)] leading-none font-black drop-shadow-lg ${
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

      {/* Instructions - Toggle visibility */}
      {showInstructions && (
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-20 max-w-[200px] sm:max-w-sm">
          <div className="bg-black/60 backdrop-blur-md rounded-lg p-3 sm:p-4 text-white text-xs sm:text-sm shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <p className="font-bold text-sm sm:text-base">📖 How to Play</p>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-white/60 hover:text-white transition text-lg"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-1 sm:space-y-1.5 text-gray-200">
              <li>• Win 3 boards in a row</li>
              <li>• Move sets next board</li>
              <li>• Win a board? Opponent plays anywhere! 🎯</li>
              <li>• 📱 Pinch/🖱️ Scroll to zoom</li>
              <li>• Drag to pan the board</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default UltimateTicTacToe;
