import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || !ytdl.validateURL(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        let agent;
        try {
            // Priority 1: Environment Variable (for Netlify/Production)
            if (process.env.YOUTUBE_COOKIES) {
                const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
                agent = ytdl.createAgent(cookies);
            }
            // Priority 2: Local File (for Development)
            else {
                const cookiesPath = path.resolve(process.cwd(), 'cookies.json');
                if (fs.existsSync(cookiesPath)) {
                    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
                    agent = ytdl.createAgent(cookies);
                }
            }
        } catch (err) {
            console.warn('Failed to load cookies:', err);
            // Fallback to default agent if cookies fail
        }

        const info = await ytdl.getInfo(url, { agent });

        // Get video+audio (usually up to 720p)
        const mixedFormats = ytdl.filterFormats(info.formats, 'videoandaudio');

        // Get high quality video-only (1080p, 1440p, 4K)
        const videoOnlyFormats = ytdl.filterFormats(info.formats, 'videoonly')
            .filter(f => f.qualityLabel && (f.height >= 1080));

        // Get audio-only
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

        // Sort by resolution
        mixedFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
        videoOnlyFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

        // Simplify data for frontend
        const payload = {
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails.pop()?.url,
            duration: info.videoDetails.lengthSeconds,
            videoId: info.videoDetails.videoId,
            formats: [
                ...mixedFormats.map(f => ({
                    itag: f.itag,
                    quality: f.qualityLabel,
                    container: f.container,
                    type: 'video',
                    hasAudio: true
                })),
                ...videoOnlyFormats.map(f => ({
                    itag: f.itag,
                    quality: f.qualityLabel,
                    container: f.container,
                    type: 'video',
                    hasAudio: false
                })),
                ...audioFormats.map(f => ({
                    itag: f.itag,
                    quality: 'Audio',
                    container: f.container,
                    type: 'audio',
                    hasAudio: true
                }))
            ]
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('YTDL Error:', error);
        return NextResponse.json({ error: 'Failed to fetch video info. ' + error.message }, { status: 500 });
    }
}
