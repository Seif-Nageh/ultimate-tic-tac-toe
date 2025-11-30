// Database layer using Supabase for persistent storage
import { supabase } from './supabase';

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
  playerLeft?: Player | null;
}

export interface Room {
  id: string;
  password: string;
  gameState: GameState;
  version: number;
  lastUpdated: number;
}

// Database row type from Supabase
interface RoomRow {
  id: string;
  password: string;
  game_state: GameState;
  version: number;
  last_updated: string;
}

function rowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    password: row.password,
    gameState: row.game_state,
    version: row.version,
    lastUpdated: new Date(row.last_updated).getTime()
  };
}

export const db = {
  createRoom: async (id: string, password: string, gameState: GameState): Promise<boolean> => {
    const { error } = await supabase
      .from('rooms')
      .insert({
        id,
        password,
        game_state: gameState,
        version: 0,
        last_updated: new Date().toISOString()
      });

    if (error) {
      console.error('Create room error:', error);
      return false;
    }
    return true;
  },

  getRoom: async (id: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }
    return rowToRoom(data as RoomRow);
  },

  updateRoom: async (id: string, gameState: GameState): Promise<boolean> => {
    const { error } = await supabase
      .from('rooms')
      .update({
        game_state: gameState,
        last_updated: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Update room error:', error);
      return false;
    }
    return true;
  },

  updateRoomWithVersion: async (id: string, gameState: GameState): Promise<number | null> => {
    // First get current version
    const { data: currentRoom } = await supabase
      .from('rooms')
      .select('version')
      .eq('id', id)
      .single();

    if (!currentRoom) return null;

    const newVersion = currentRoom.version + 1;

    const { error } = await supabase
      .from('rooms')
      .update({
        game_state: gameState,
        version: newVersion,
        last_updated: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Update room with version error:', error);
      return null;
    }
    return newVersion;
  },

  deleteRoom: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete room error:', error);
      return false;
    }
    return true;
  }
};
