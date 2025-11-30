import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const roomId = uuidv4().slice(0, 6).toUpperCase(); // Short 6-char ID

        const initialState = {
            boards: Array(9).fill(null).map(() => Array(9).fill(null)),
            boardWinners: Array(9).fill(null),
            currentPlayer: 'X',
            activeBoard: null,
            gameWinner: null,
            players: {
                X: 'connected',
                O: 'waiting'
            },
            rematchRequests: {
                X: false,
                O: false
            }
        };

        db.createRoom(roomId, password || '', initialState);

        return NextResponse.json({ roomId });
    } catch (error) {
        console.error('Create room error:', error);
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }
}
