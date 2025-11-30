import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export async function POST(request: Request) {
  try {
    // Handle both JSON and text/plain (from sendBeacon)
    const contentType = request.headers.get('content-type') || '';
    let roomId: string | undefined;
    let player: string | undefined;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      roomId = body.roomId;
      player = body.player;
    } else {
      // sendBeacon sends as text/plain
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        roomId = body.roomId;
        player = body.player;
      } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
    }

    if (!roomId || !player) {
      return NextResponse.json({ error: 'Missing roomId or player' }, { status: 400 });
    }

    const room = await db.getRoom(roomId);
    if (!room) {
      // Room might have been cleaned up - that's okay for leave
      return NextResponse.json({ success: true, message: 'Room already gone' });
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

    await db.updateRoom(roomId, newGameState);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave room error:', error);
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
