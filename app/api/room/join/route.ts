import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export async function POST(request: Request) {
    try {
        const { roomId, password } = await request.json();

        const room = db.getRoom(roomId);

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        if (room.password && room.password !== password) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        const gameState = room.gameState;

        // If O is already connected, room is full
        if (gameState.players.O === 'connected') {
            // Allow re-joining if it's just a refresh (simplified logic: just return success for now)
            // In a real app we'd use sessions/tokens
        } else {
            gameState.players.O = 'connected';
            db.updateRoom(roomId, gameState);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Join room error:', error);
        return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }
}
