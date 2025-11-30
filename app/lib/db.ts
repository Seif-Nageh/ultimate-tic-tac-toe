// In-memory store for game rooms
// In production, replace this with a real database (PostgreSQL, MongoDB, etc.)

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardWinner = Player | 'DRAW' | null;

export interface GameState {
  boards: CellValue[][];
  boardWinners: BoardWinner[];
  currentPlayer: Player;
  activeBoard: number | null;
  gameWinner: BoardWinner;
  players: { X: string; O: string };
  rematchRequests?: { X: boolean; O: boolean };
}

export interface Room {
  id: string;
  password: string;
  gameState: GameState;
  version: number;  // Increments on each move - prevents race conditions
  lastUpdated: number;
}

// Use globalThis to persist across hot reloads in Next.js dev mode
const globalForDb = globalThis as unknown as { rooms: Map<string, Room> | undefined };

const rooms = globalForDb.rooms ?? new Map<string, Room>();

// Persist to globalThis
if (process.env.NODE_ENV !== 'production') {
  globalForDb.rooms = rooms;
}

export const db = {
  createRoom: (id: string, password: string, gameState: GameState) => {
    rooms.set(id, {
      id,
      password,
      gameState,
      version: 0,
      lastUpdated: Date.now()
    });
  },

  getRoom: (id: string): Room | undefined => {
    return rooms.get(id);
  },

  updateRoom: (id: string, gameState: GameState) => {
    const room = rooms.get(id);
    if (room) {
      room.gameState = gameState;
      room.lastUpdated = Date.now();
    }
  },

  // New: Update room with version increment (for moves)
  updateRoomWithVersion: (id: string, gameState: GameState): number | null => {
    const room = rooms.get(id);
    if (room) {
      room.gameState = gameState;
      room.version += 1;
      room.lastUpdated = Date.now();
      return room.version;
    }
    return null;
  },

  deleteRoom: (id: string) => {
    rooms.delete(id);
  }
};

// Clean up old rooms (older than 24 hours)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [id, room] of rooms.entries()) {
    if (now - room.lastUpdated > maxAge) {
      rooms.delete(id);
    }
  }
}, 60 * 60 * 1000); // Run every hour

