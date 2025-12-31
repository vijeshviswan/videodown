import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || !ytdl.validateURL(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        const info = await ytdl.getInfo(url);

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
