import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || 'image.jpg';
    
    // Upload image to Vercel Blob storage
    const blob = await put(filename, request.body, { access: 'public' });
    
    return NextResponse.json({ url: blob.url });
}
