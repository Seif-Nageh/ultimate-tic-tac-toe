// In-memory store for game rooms
// In production, replace this with a real database (PostgreSQL, MongoDB, etc.)

interface Room {
  id: string;
  password: string;
  gameState: any;
  lastUpdated: number;
}

const rooms = new Map<string, Room>();

export const db = {
  createRoom: (id: string, password: string, gameState: any) => {
    rooms.set(id, {
      id,
      password,
      gameState,
      lastUpdated: Date.now()
    });
  },

  getRoom: (id: string): Room | undefined => {
    return rooms.get(id);
  },

  updateRoom: (id: string, gameState: any) => {
    const room = rooms.get(id);
    if (room) {
      room.gameState = gameState;
      room.lastUpdated = Date.now();
    }
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

