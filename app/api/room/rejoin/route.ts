import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export async function POST(request: Request) {
  try {
    const { roomId, password, player } = await request.json();

    if (!roomId || !player) {
      return NextResponse.json({ error: 'Missing roomId or player' }, { status: 400 });
    }

    const room = await db.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // Verify password if room has one
    if (room.password && room.password !== password) {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 403 });
    }

    // Mark the player as reconnected and clear playerLeft
    const newGameState = {
      ...room.gameState,
      players: {
        ...room.gameState.players,
        [player]: 'connected'
      },
      playerLeft: null
    };

    await db.updateRoom(roomId, newGameState);

    return NextResponse.json({
      success: true,
      gameState: newGameState
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to rejoin room' }, { status: 500 });
  }
}
