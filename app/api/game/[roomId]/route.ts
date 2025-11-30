import { NextResponse } from 'next/server';
import { db } from '@/app/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const room = db.getRoom(roomId);

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        return NextResponse.json(room.gameState);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch game state' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const newState = await request.json();

        db.updateRoom(roomId, newState);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update game state' }, { status: 500 });
    }
}
