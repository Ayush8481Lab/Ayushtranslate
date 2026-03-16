"use client";
import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function Home() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("Waiting for upload...");
    const [jobLink, setJobLink] = useState("");

    const processUpload = async () => {
        if (!file) return;
        setStatus("Extracting PDF pages...");
        
        try {
            // 1. Extract PDF to Images in browser
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const totalPages = pdf.numPages;
            const imageUrls =[];

            for (let i = 1; i <= totalPages; i++) {
                setStatus(`Uploading Page ${i} of ${totalPages}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width; canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                
                const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
                
                // Upload to Vercel Blob
                const res = await fetch(`/api/upload?filename=page_${i}.jpg`, {
                    method: 'POST', body: blob
                });
                const { url } = await res.json();
                imageUrls.push(url);
            }

            // 2. Create Job in Database
            setStatus("Starting AI processing... You can safely close this page!");
            const jobRes = await fetch('/api/job', {
                method: 'POST',
                body: JSON.stringify({ images: imageUrls, total: totalPages })
            });
            const { jobId } = await jobRes.json();
            
            // 3. Trigger background worker and give link
            fetch(`/api/worker?jobId=${jobId}`); // Triggers background process (no await)
            
            const link = `${window.location.origin}?job=${jobId}`;
            setJobLink(link);
            setStatus("Success! Keep this link to check status and download later.");

        } catch (error) {
            setStatus("Error: " + error.message);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
            <h2>Neural Translate Pro (Vercel Edition)</h2>
            <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
                <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
                <button 
                    onClick={processUpload} 
                    style={{ display: 'block', marginTop: '15px', padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: '5px' }}>
                    Upload & Process in Background
                </button>
            </div>
            
            <p style={{ marginTop: '20px', fontWeight: 'bold' }}>{status}</p>
            
            {jobLink && (
                <div style={{ padding: '15px', background: '#eef2ff', borderRadius: '8px', wordBreak: 'break-all' }}>
                    <strong>Your Shareable Link (Valid 24 Hrs):</strong><br/>
                    <a href={jobLink}>{jobLink}</a>
                </div>
            )}
        </div>
    );
}
