'use client';

import React, { useState, useRef, useEffect } from 'react';

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardWinner = Player | 'DRAW' | null;
type GameMode = 'solo' | 'multi-offline' | 'multi-online';

type AIDifficulty = 'easy' | 'medium' | 'hard';

interface UltimateTicTacToeProps {
  gameMode: GameMode;
  onBackToHome: () => void;
  roomId?: string;
  password?: string;
  initialPlayer?: Player;
  aiDifficulty?: AIDifficulty;
}

const UltimateTicTacToe: React.FC<UltimateTicTacToeProps> = ({ gameMode, onBackToHome, roomId, initialPlayer, aiDifficulty = 'medium' }) => {
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

  // New: Sync and error handling state
  const [stateVersion, setStateVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const pendingMoveRef = useRef<{ boardIndex: number; cellIndex: number } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Get adaptive polling interval
  const getPollingInterval = () => {
    if (gameWinner) return 5000;           // Game over: slow (5s)
    if (currentPlayer === myPlayer) return 2000;  // My turn: medium (2s)
    return 500;                            // Their turn: fast (500ms)
  };

  // Smart polling for online game state
  useEffect(() => {
    if (gameMode === 'multi-online' && roomId) {
      let timeoutId: NodeJS.Timeout;

      const poll = async () => {
        try {
          const res = await fetch(`/api/game/${roomId}`);
          const data = await res.json();
          if (data && !data.error) {
            // Only update if server version is newer
            if (data.version !== undefined && data.version > stateVersion) {
              setStateVersion(data.version);
              setBoards(data.boards);
              setBoardWinners(data.boardWinners);
              setCurrentPlayer(data.currentPlayer);
              setActiveBoard(data.activeBoard);
              setGameWinner(data.gameWinner);
            }

            // Check for rematch requests
            if (data.rematchRequests) {
              setRematchRequests(data.rematchRequests);

              if (data.rematchRequests.X && data.rematchRequests.O) {
                setShowRematchNotification(false);
              } else if (data.rematchRequests[myPlayer === 'X' ? 'O' : 'X']) {
                setShowRematchNotification(true);
              }
            }
          }
        } catch (e) {
          console.error('Polling error:', e);
        }

        // Schedule next poll with adaptive interval
        timeoutId = setTimeout(poll, getPollingInterval());
      };

      // Start polling
      timeoutId = setTimeout(poll, getPollingInterval());

      return () => clearTimeout(timeoutId);
    }
  }, [gameMode, roomId, myPlayer, stateVersion, currentPlayer, gameWinner]);

  // Legacy sync state (for rematch)
  const syncState = async (newState: object) => {
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

  // New: Submit move with validation and retry
  const submitMove = async (boardIndex: number, cellIndex: number): Promise<boolean> => {
    if (!roomId) return false;

    setSyncStatus('syncing');
    setSyncError(null);
    pendingMoveRef.current = { boardIndex, cellIndex };

    try {
      const res = await fetch(`/api/game/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardIndex,
          cellIndex,
          player: myPlayer,
          expectedVersion: stateVersion
        })
      });

      const data = await res.json();

      if (data.success) {
        // Update local state with server response
        setBoards(data.newState.boards);
        setBoardWinners(data.newState.boardWinners);
        setCurrentPlayer(data.newState.currentPlayer);
        setActiveBoard(data.newState.activeBoard);
        setGameWinner(data.newState.gameWinner);
        setStateVersion(data.version);
        setSyncStatus('idle');
        pendingMoveRef.current = null;
        retryCountRef.current = 0;
        return true;
      } else {
        // Handle specific errors
        if (data.error === 'stale_state') {
          // State changed - fetch latest and notify user
          setStateVersion(data.currentVersion);
          if (data.currentState) {
            setBoards(data.currentState.boards);
            setBoardWinners(data.currentState.boardWinners);
            setCurrentPlayer(data.currentState.currentPlayer);
            setActiveBoard(data.currentState.activeBoard);
            setGameWinner(data.currentState.gameWinner);
          }
          setSyncError('Opponent moved! Try again.');
          setSyncStatus('error');
        } else {
          setSyncError(data.message || 'Move failed');
          setSyncStatus('error');
        }
        pendingMoveRef.current = null;
        return false;
      }
    } catch (e) {
      console.error('Move error:', e);

      // Auto-retry on network error
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setSyncError(`Retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, 1000));
        return submitMove(boardIndex, cellIndex);
      }

      setSyncError('Connection failed. Click to retry.');
      setSyncStatus('error');
      return false;
    }
  };

  // Manual retry
  const retryMove = async () => {
    if (pendingMoveRef.current) {
      retryCountRef.current = 0;
      await submitMove(pendingMoveRef.current.boardIndex, pendingMoveRef.current.cellIndex);
    }
  };

  // Dismiss error
  const dismissError = () => {
    setSyncStatus('idle');
    setSyncError(null);
    pendingMoveRef.current = null;
    retryCountRef.current = 0;
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

    // Check for overall game draw - all boards decided and no winner possible
    const allBoardsDecided = winners.every(w => w !== null);
    if (allBoardsDecided) {
      // Check if any winning line is still possible
      for (const line of lines) {
        const [a, b, c] = line;
        const lineValues = [winners[a], winners[b], winners[c]];
        // A line is still winnable if it has at least one player and no opponent
        const hasX = lineValues.some(v => v === 'X');
        const hasO = lineValues.some(v => v === 'O');
        if ((hasX && !hasO) || (hasO && !hasX)) {
          // This shouldn't happen if all boards are decided, but safety check
          continue;
        }
      }
      return 'DRAW';
    }

    // Check if the game is unwinnable (all lines blocked)
    let xCanWin = false;
    let oCanWin = false;
    for (const line of lines) {
      const [a, b, c] = line;
      const lineValues = [winners[a], winners[b], winners[c]];
      const hasX = lineValues.some(v => v === 'X');
      const hasO = lineValues.some(v => v === 'O');
      const hasDraw = lineValues.some(v => v === 'DRAW');

      // X can still win this line if no O or DRAW blocking
      if (!hasO && !hasDraw) xCanWin = true;
      // O can still win this line if no X or DRAW blocking
      if (!hasX && !hasDraw) oCanWin = true;
    }

    // If neither player can win anymore, it's a draw
    if (!xCanWin && !oCanWin) {
      return 'DRAW';
    }

    return null;
  };

  // Winning lines constant
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  // Find a winning move for a player in a board
  const findWinningMove = (cells: (CellValue | BoardWinner)[], player: Player): number | null => {
    for (const line of LINES) {
      const [a, b, c] = line;
      const values = [cells[a], cells[b], cells[c]];
      const playerCount = values.filter(v => v === player).length;
      const emptyCount = values.filter(v => v === null).length;

      if (playerCount === 2 && emptyCount === 1) {
        if (cells[a] === null) return a;
        if (cells[b] === null) return b;
        if (cells[c] === null) return c;
      }
    }
    return null;
  };


  // Evaluate a small board's strategic value
  const evaluateBoard = (board: CellValue[], player: Player): number => {
    const opponent = player === 'X' ? 'O' : 'X';
    let score = 0;

    // Check if board is won
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] === player ? 100 : -100;
      }
    }

    // Evaluate position
    for (const line of LINES) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];
      const playerCount = values.filter(v => v === player).length;
      const opponentCount = values.filter(v => v === opponent).length;
      const emptyCount = values.filter(v => v === null).length;

      if (playerCount === 2 && emptyCount === 1) score += 10; // Threat
      if (playerCount === 1 && emptyCount === 2) score += 2;  // Potential
      if (opponentCount === 2 && emptyCount === 1) score -= 10; // Block needed
      if (opponentCount === 1 && emptyCount === 2) score -= 2;
    }

    // Center control bonus
    if (board[4] === player) score += 4;
    if (board[4] === opponent) score -= 4;

    // Corner control
    const corners = [0, 2, 6, 8];
    for (const corner of corners) {
      if (board[corner] === player) score += 2;
      if (board[corner] === opponent) score -= 2;
    }

    return score;
  };

  // Evaluate the meta-game (board winners level)
  const evaluateMetaGame = (winners: BoardWinner[], player: Player): number => {
    const opponent = player === 'X' ? 'O' : 'X';
    let score = 0;

    // Check for win
    for (const line of LINES) {
      const [a, b, c] = line;
      if (winners[a] && winners[a] !== 'DRAW' &&
          winners[a] === winners[b] && winners[a] === winners[c]) {
        return winners[a] === player ? 10000 : -10000;
      }
    }

    // Evaluate meta-game position
    for (const line of LINES) {
      const [a, b, c] = line;
      const values = [winners[a], winners[b], winners[c]];
      const playerCount = values.filter(v => v === player).length;
      const opponentCount = values.filter(v => v === opponent).length;
      const drawCount = values.filter(v => v === 'DRAW').length;

      // Line is still winnable by player
      if (opponentCount === 0 && drawCount === 0) {
        if (playerCount === 2) score += 500; // One away from winning
        if (playerCount === 1) score += 50;
      }
      // Line is winnable by opponent
      if (playerCount === 0 && drawCount === 0) {
        if (opponentCount === 2) score -= 500;
        if (opponentCount === 1) score -= 50;
      }
    }

    // Center board is strategically valuable
    if (winners[4] === player) score += 100;
    if (winners[4] === opponent) score -= 100;

    // Corner boards
    for (const corner of [0, 2, 6, 8]) {
      if (winners[corner] === player) score += 30;
      if (winners[corner] === opponent) score -= 30;
    }

    return score;
  };

  // Check where this move would send the opponent
  const evaluateSendLocation = (
    cellIndex: number,
    currentBoards: CellValue[][],
    currentWinners: BoardWinner[],
    player: Player
  ): number => {
    const opponent = player === 'X' ? 'O' : 'X';

    // If sending to a won/drawn board, opponent can play anywhere - bad!
    if (currentWinners[cellIndex]) {
      return -50;
    }

    const targetBoard = currentBoards[cellIndex];

    // Check if opponent has a winning move there
    if (findWinningMove(targetBoard, opponent) !== null) {
      return -30; // Sending them where they can win
    }

    // Check if we have a winning move there (they'll have to block)
    if (findWinningMove(targetBoard, player) !== null) {
      return 20;
    }

    // Evaluate board control
    const boardScore = evaluateBoard(targetBoard, player);
    return boardScore / 10; // Scale down
  };

  // Get all valid moves
  const getValidMoves = (
    currentBoards: CellValue[][],
    currentWinners: BoardWinner[],
    currentActiveBoard: number | null
  ): { boardIndex: number; cellIndex: number }[] => {
    const moves: { boardIndex: number; cellIndex: number }[] = [];
    const availableBoards = currentActiveBoard !== null
      ? [currentActiveBoard].filter(i => !currentWinners[i])
      : currentBoards.map((_, i) => i).filter(i => !currentWinners[i]);

    for (const boardIdx of availableBoards) {
      for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
        if (currentBoards[boardIdx][cellIdx] === null) {
          moves.push({ boardIndex: boardIdx, cellIndex: cellIdx });
        }
      }
    }
    return moves;
  };

  // Simulate a move and return new state
  const simulateMove = (
    currentBoards: CellValue[][],
    currentWinners: BoardWinner[],
    boardIndex: number,
    cellIndex: number,
    player: Player
  ): { boards: CellValue[][], winners: BoardWinner[], nextActive: number | null } => {
    const newBoards = currentBoards.map((board, i) =>
      i === boardIndex ? board.map((cell, j) => j === cellIndex ? player : cell) : [...board]
    );

    const newWinners = [...currentWinners];
    const winner = checkBoardWinner(newBoards[boardIndex]);
    if (winner) {
      newWinners[boardIndex] = winner;
    }

    // Determine next active board
    let nextActive: number | null = null;
    if (winner) {
      nextActive = null; // Current rule: winning a board lets opponent play anywhere
    } else if (newWinners[cellIndex]) {
      nextActive = null;
    } else {
      nextActive = cellIndex;
    }

    return { boards: newBoards, winners: newWinners, nextActive };
  };

  // Minimax with alpha-beta pruning
  const minimax = (
    currentBoards: CellValue[][],
    currentWinners: BoardWinner[],
    currentActiveBoard: number | null,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    player: Player
  ): number => {
    const opponent = player === 'X' ? 'O' : 'X';

    // Check terminal states
    const gameResult = checkGameWinner(currentWinners);
    if (gameResult === player) return 10000 - depth;
    if (gameResult === opponent) return -10000 + depth;
    if (gameResult === 'DRAW') return 0;

    // Depth limit reached - evaluate position
    if (depth === 0) {
      return evaluateMetaGame(currentWinners, player);
    }

    const moves = getValidMoves(currentBoards, currentWinners, currentActiveBoard);
    if (moves.length === 0) return 0;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const { boards, winners, nextActive } = simulateMove(
          currentBoards, currentWinners, move.boardIndex, move.cellIndex, player
        );
        const evalScore = minimax(boards, winners, nextActive, depth - 1, alpha, beta, false, player);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const { boards, winners, nextActive } = simulateMove(
          currentBoards, currentWinners, move.boardIndex, move.cellIndex, opponent
        );
        const evalScore = minimax(boards, winners, nextActive, depth - 1, alpha, beta, true, player);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  // AI Logic for Solo Mode - Multi-difficulty
  const getAIMove = (): { boardIndex: number; cellIndex: number } | null => {
    const moves = getValidMoves(boards, boardWinners, activeBoard);
    if (moves.length === 0) return null;

    // Easy: Random with slight preference for good moves
    if (aiDifficulty === 'easy') {
      // 70% random, 30% smart
      if (Math.random() < 0.7) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      // Fall through to simple heuristic
      for (const move of moves) {
        if (findWinningMove(boards[move.boardIndex], 'O') === move.cellIndex) {
          return move;
        }
      }
      for (const move of moves) {
        if (findWinningMove(boards[move.boardIndex], 'X') === move.cellIndex) {
          return move;
        }
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Medium: Heuristic-based without deep search
    if (aiDifficulty === 'medium') {
      let bestMove = moves[0];
      let bestScore = -Infinity;

      for (const move of moves) {
        let score = 0;

        // Immediate win on this board
        if (findWinningMove(boards[move.boardIndex], 'O') === move.cellIndex) {
          score += 1000;
          // Check if this wins a critical meta-game position
          const simulated = simulateMove(boards, boardWinners, move.boardIndex, move.cellIndex, 'O');
          if (findWinningMove(simulated.winners, 'O') !== null) {
            score += 5000;
          }
        }

        // Block opponent win
        if (findWinningMove(boards[move.boardIndex], 'X') === move.cellIndex) {
          score += 500;
        }

        // Strategic board positions
        const metaWinMove = findWinningMove(boardWinners, 'O');
        if (metaWinMove === move.boardIndex) {
          score += 300;
        }
        const metaBlockMove = findWinningMove(boardWinners, 'X');
        if (metaBlockMove === move.boardIndex) {
          score += 200;
        }

        // Board position value
        score += evaluateBoard(boards[move.boardIndex], 'O') / 10;

        // Center cell preference
        if (move.cellIndex === 4) score += 15;
        // Corner preference
        if ([0, 2, 6, 8].includes(move.cellIndex)) score += 8;

        // Consider where we send the opponent
        score += evaluateSendLocation(move.cellIndex, boards, boardWinners, 'O');

        // Small randomness to avoid predictability
        score += Math.random() * 5;

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      return bestMove;
    }

    // Hard: Minimax with alpha-beta pruning
    const searchDepth = moves.length > 30 ? 3 : moves.length > 15 ? 4 : 5;
    let bestMove = moves[0];
    let bestScore = -Infinity;

    // Sort moves by heuristic for better pruning
    const scoredMoves = moves.map(move => {
      let priority = 0;
      if (findWinningMove(boards[move.boardIndex], 'O') === move.cellIndex) priority += 100;
      if (findWinningMove(boards[move.boardIndex], 'X') === move.cellIndex) priority += 50;
      if (move.cellIndex === 4) priority += 10;
      return { move, priority };
    }).sort((a, b) => b.priority - a.priority);

    for (const { move } of scoredMoves) {
      const { boards: newBoards, winners: newWinners, nextActive } = simulateMove(
        boards, boardWinners, move.boardIndex, move.cellIndex, 'O'
      );

      // Check immediate win
      const gameResult = checkGameWinner(newWinners);
      if (gameResult === 'O') {
        return move;
      }

      const score = minimax(
        newBoards, newWinners, nextActive,
        searchDepth, -Infinity, Infinity, false, 'O'
      );

      // Add small evaluation for send location
      const adjustedScore = score + evaluateSendLocation(move.cellIndex, boards, boardWinners, 'O') * 0.1;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    }

    return bestMove;
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
  const handleCellClick = async (boardIndex: number, cellIndex: number) => {
    if (gameWinner) return;
    if (boardWinners[boardIndex]) return; // Board already won
    if (boards[boardIndex][cellIndex]) return; // Cell already taken
    if (activeBoard !== null && activeBoard !== boardIndex) return; // Wrong board

    // In solo mode, prevent player from moving when it's AI's turn (but allow AI moves)
    if (gameMode === 'solo' && currentPlayer === 'O' && !isAIMoveRef.current) return;

    // In online mode, prevent moving if it's not my turn or syncing
    if (gameMode === 'multi-online') {
      if (currentPlayer !== myPlayer) return;
      if (syncStatus === 'syncing') return; // Prevent double moves

      // Use validated move API
      await submitMove(boardIndex, cellIndex);
      return;
    }

    // Reset AI move flag after using it
    if (isAIMoveRef.current) {
      isAIMoveRef.current = false;
    }

    // Make move locally (for solo/local multiplayer)
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
      const gameWinnerResult = checkGameWinner(newBoardWinners);
      if (gameWinnerResult) {
        setGameWinner(gameWinnerResult);
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
          setStateVersion(0); // Reset version for new game
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

      {/* Sync Status Indicator (Online Mode) */}
      {gameMode === 'multi-online' && (syncStatus === 'syncing' || syncStatus === 'error') && (
        <div className="absolute top-32 sm:top-40 left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            {syncStatus === 'syncing' ? (
              <div className="bg-yellow-500/90 backdrop-blur-md rounded-lg px-4 py-2 inline-flex items-center gap-2 pointer-events-auto">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-white">Syncing move...</span>
              </div>
            ) : syncStatus === 'error' && syncError && (
              <div className="bg-red-500/90 backdrop-blur-md rounded-lg px-4 py-2 inline-flex items-center gap-3 pointer-events-auto">
                <span className="text-sm font-medium text-white">{syncError}</span>
                {pendingMoveRef.current && (
                  <button
                    onClick={retryMove}
                    className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-semibold text-white transition"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={dismissError}
                  className="text-white/70 hover:text-white text-lg leading-none transition"
                >
                  ×
                </button>
              </div>
            )}
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
