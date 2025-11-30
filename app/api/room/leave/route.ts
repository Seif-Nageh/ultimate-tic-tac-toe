import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export async function POST(request: Request) {
  try {
    const { roomId, player } = await request.json();

    if (!roomId || !player) {
      return NextResponse.json({ error: 'Missing roomId or player' }, { status: 400 });
    }

    const room = db.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Mark the player as disconnected
    const newGameState = {
      ...room.gameState,
      players: {
        ...room.gameState.players,
        [player]: 'disconnected'
      },
      playerLeft: player as 'X' | 'O'
    };

    db.updateRoom(roomId, newGameState);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
