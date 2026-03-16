import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = Redis.fromEnv();

const TRANSLATE_APIS =[
    "https://translate.google.com/translate_a/single?client=web&sl=auto&tl=hi&dt=t&q=",
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=",
    "https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=hi&dt=t&q=",
    "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=hi&q=",
    "https://clients4.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=hi&q=",
    "https://clients3.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=hi&q=",
    "https://clients2.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=hi&q=",
    "https://clients1.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=hi&q="
];

async function robustTranslate(text) {
    for (let api of TRANSLATE_APIS) {
        try {
            const res = await fetch(api + encodeURIComponent(text));
            if (!res.ok) continue;
            const data = await res.json();
            
            let result = "";
            if (Array.isArray(data) && Array.isArray(data[0])) {
                data[0].forEach(seg => { if (typeof seg[0] === 'string') result += seg[0]; });
            } else if (Array.isArray(data) && typeof data[0] === 'string') {
                result = data[0];
            } else if (data.sentences) {
                data.sentences.forEach(s => { if(s.trans) result += s.trans; });
            }
            if (result) return result;
        } catch (e) { continue; }
    }
    return text;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    // 1. Fetch Job Status using Upstash
    const job = await redis.get(`job:${jobId}`);
    if (!job || job.status === "completed") return NextResponse.json({ message: "Done or Not found" });

    const currentIndex = job.completed;
    const imageUrl = job.images[currentIndex];

    try {
        // NOTE: Replace 'helloworld' with your actual OCR Space API Key
        const ocrRes = await fetch(`https://api.ocr.space/parse/imageurl?apikey=K85930805288957&url=${encodeURIComponent(imageUrl)}&language=eng&isOverlayRequired=false`);
        const ocrData = await ocrRes.json();
        
        let extractedText = "No text found";
        if (ocrData.ParsedResults && ocrData.ParsedResults[0]) {
            extractedText = ocrData.ParsedResults[0].ParsedText;
        }

        const translatedText = await robustTranslate(extractedText);

        job.translations.push(translatedText);
        job.completed += 1;
        
        if (job.completed >= job.total) {
            job.status = "completed";
        }
        
        // Update Job in Upstash
        await redis.set(`job:${jobId}`, job, { ex: 86400 });

        if (job.status !== "completed") {
            const nextUrl = new URL(request.url);
            fetch(nextUrl.toString(), { method: 'GET' }).catch(()=>{});
        }

        return NextResponse.json({ success: true, page: currentIndex + 1, status: job.status });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
