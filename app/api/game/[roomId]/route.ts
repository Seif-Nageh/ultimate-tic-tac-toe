import { NextResponse } from 'next/server';
import { db, GameState } from '@/app/lib/db';

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardWinner = Player | 'DRAW' | null;

// Winning lines for tic-tac-toe
const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
];

// Check if a small board has a winner
function checkBoardWinner(board: CellValue[]): BoardWinner {
    for (const line of LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as Player;
        }
    }
    if (board.every(cell => cell !== null)) {
        return 'DRAW';
    }
    return null;
}

// Check if game has overall winner
function checkGameWinner(winners: BoardWinner[]): BoardWinner {
    for (const line of LINES) {
        const [a, b, c] = line;
        if (winners[a] && winners[a] !== 'DRAW' &&
            winners[a] === winners[b] && winners[a] === winners[c]) {
            return winners[a];
        }
    }

    // Check for draw
    const allDecided = winners.every(w => w !== null);
    if (allDecided) return 'DRAW';

    // Check if unwinnable
    let xCanWin = false, oCanWin = false;
    for (const line of LINES) {
        const [a, b, c] = line;
        const values = [winners[a], winners[b], winners[c]];
        if (!values.includes('O') && !values.includes('DRAW')) xCanWin = true;
        if (!values.includes('X') && !values.includes('DRAW')) oCanWin = true;
    }
    if (!xCanWin && !oCanWin) return 'DRAW';

    return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const room = await db.getRoom(roomId);

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Include version in response for sync
        return NextResponse.json({
            ...room.gameState,
            version: room.version
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch game state' }, { status: 500 });
    }
}

// Legacy POST - still used for rematch and initial state sync
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const newState = await request.json();

        await db.updateRoom(roomId, newState);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update game state' }, { status: 500 });
    }
}

// New PATCH endpoint for validated moves
export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const { boardIndex, cellIndex, player, expectedVersion } = await request.json();

        const room = await db.getRoom(roomId);
        if (!room) {
            return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
        }

        const state = room.gameState;

        // Validate version (prevent race conditions)
        if (expectedVersion !== room.version) {
            return NextResponse.json({
                success: false,
                error: 'stale_state',
                message: 'Game state has changed. Please refresh.',
                currentVersion: room.version,
                currentState: state
            });
        }

        // Validate it's this player's turn
        if (state.currentPlayer !== player) {
            return NextResponse.json({
                success: false,
                error: 'not_your_turn',
                message: `It's ${state.currentPlayer}'s turn`
            });
        }

        // Validate game not over
        if (state.gameWinner) {
            return NextResponse.json({
                success: false,
                error: 'game_over',
                message: 'Game is already over'
            });
        }

        // Validate board index
        if (boardIndex < 0 || boardIndex > 8) {
            return NextResponse.json({
                success: false,
                error: 'invalid_board',
                message: 'Invalid board index'
            });
        }

        // Validate cell index
        if (cellIndex < 0 || cellIndex > 8) {
            return NextResponse.json({
                success: false,
                error: 'invalid_cell',
                message: 'Invalid cell index'
            });
        }

        // Validate board isn't already won
        if (state.boardWinners[boardIndex]) {
            return NextResponse.json({
                success: false,
                error: 'board_won',
                message: 'This board is already won'
            });
        }

        // Validate active board rule
        if (state.activeBoard !== null && state.activeBoard !== boardIndex) {
            return NextResponse.json({
                success: false,
                error: 'wrong_board',
                message: `You must play on board ${state.activeBoard + 1}`
            });
        }

        // Validate cell is empty
        if (state.boards[boardIndex][cellIndex] !== null) {
            return NextResponse.json({
                success: false,
                error: 'cell_taken',
                message: 'This cell is already taken'
            });
        }

        // Make the move
        const newBoards = state.boards.map((board, i) =>
            i === boardIndex
                ? board.map((cell, j) => j === cellIndex ? player : cell)
                : [...board]
        );

        // Check if this move won the board
        const newBoardWinners = [...state.boardWinners];
        const boardWinner = checkBoardWinner(newBoards[boardIndex]);
        if (boardWinner) {
            newBoardWinners[boardIndex] = boardWinner;
        }

        // Check if game is won
        const gameWinner = checkGameWinner(newBoardWinners);

        // Determine next active board
        let nextActiveBoard: number | null = null;
        if (boardWinner) {
            // Won a board - opponent can play anywhere
            nextActiveBoard = null;
        } else if (newBoardWinners[cellIndex]) {
            // Sent to a won board - opponent can play anywhere
            nextActiveBoard = null;
        } else {
            nextActiveBoard = cellIndex;
        }

        // Switch player
        const nextPlayer: Player = player === 'X' ? 'O' : 'X';

        // Create new state
        const newState: GameState = {
            ...state,
            boards: newBoards,
            boardWinners: newBoardWinners,
            currentPlayer: nextPlayer,
            activeBoard: nextActiveBoard,
            gameWinner: gameWinner
        };

        // Update with version increment
        const newVersion = await db.updateRoomWithVersion(roomId, newState);

        return NextResponse.json({
            success: true,
            newState: {
                boards: newState.boards,
                boardWinners: newState.boardWinners,
                currentPlayer: newState.currentPlayer,
                activeBoard: newState.activeBoard,
                gameWinner: newState.gameWinner
            },
            version: newVersion
        });
    } catch (error) {
        console.error('Move error:', error);
        return NextResponse.json({
            success: false,
            error: 'server_error',
            message: 'Failed to process move'
        }, { status: 500 });
    }
}
