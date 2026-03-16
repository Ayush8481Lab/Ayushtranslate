import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const { images, total } = await request.json();
    const jobId = Math.random().toString(36).substring(2, 10);
    
    // Create Job, Expires in 86400 seconds (24 Hours)
    await kv.set(`job:${jobId}`, {
        status: "processing",
        total: total,
        completed: 0,
        images: images,
        translations:[]
    }, { ex: 86400 });

    return NextResponse.json({ jobId });
}
