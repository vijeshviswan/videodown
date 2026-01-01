import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath);

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const itag = searchParams.get('itag');
    const name = searchParams.get('name') || 'video';
    const hasAudio = searchParams.get('hasAudio') !== 'false';

    if (!url || !itag) {
        return new NextResponse('Missing parameters', { status: 400 });
    }

    try {
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
        }

        const cleanName = name.replace(/[^\w\s-]/g, '').trim();

        // 1. Simple Download (Audio only or Video with Audio pre-muxed)
        if (hasAudio) {
            const info = await ytdl.getInfo(url, { agent });
            const format = info.formats.find(f => f.itag === parseInt(itag));
            if (!format) return new NextResponse('Format not found', { status: 404 });

            const filename = `${cleanName}.${format.container}`;
            const headers = new Headers();
            headers.set('Content-Disposition', `attachment; filename="${filename}"`);
            headers.set('Content-Type', 'application/octet-stream');

            // Fix: Use a proper pass-through stream to handle potential pipe issues
            const passthrough = new PassThrough();
            const videoStream = ytdl(url, { quality: parseInt(itag), agent });
            videoStream.pipe(passthrough);

            return new NextResponse(passthrough, { headers });
        }

        // 2. High Quality Download (Video-only + Audio merge)
        else {
            const info = await ytdl.getInfo(url, { agent });
            const videoFormat = info.formats.find(f => f.itag === parseInt(itag));
            const audioFormat = ytdl.filterFormats(info.formats, 'audioonly')
                .find(f => f.container === 'mp4') ||
                ytdl.filterFormats(info.formats, 'audioonly')[0];

            if (!videoFormat || !audioFormat) {
                return new NextResponse('Format not found', { status: 404 });
            }

            const filename = `${cleanName}.mp4`;
            const headers = new Headers();
            headers.set('Content-Disposition', `attachment; filename="${filename}"`);
            headers.set('Content-Type', 'video/mp4');

            // Pass header options to ffmpeg for the HTTP requests
            const inputOptions = [
                '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '-headers', `Referer: https://www.youtube.com/`
            ];

            const passthrough = new PassThrough();

            // Run FFmpeg using direct URLs
            ffmpeg()
                .input(videoFormat.url)
                .inputOptions(inputOptions)
                .input(audioFormat.url)
                .inputOptions(inputOptions)
                .outputFormat('mp4')
                .videoCodec('copy')
                .audioCodec('aac')
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    // Cannot send error response if headers already sent, but we can log
                    if (!passthrough.closed) passthrough.end();
                })
                .on('end', () => {
                    console.log('FFmpeg merged finished');
                })
                .pipe(passthrough, { end: true });

            return new NextResponse(passthrough, { headers });
        }

    } catch (error) {
        console.error('Download System Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
