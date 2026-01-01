import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath);

export async function GET(request) {
    const searchParams = new URL(request.url).searchParams;
    const url = searchParams.get('url');
    const itag = searchParams.get('itag');
    const name = searchParams.get('name') || 'video';
    const hasAudio = searchParams.get('hasAudio') !== 'false';

    if (!url || !itag) {
        return new NextResponse('Missing parameters', { status: 400 });
    }

    let agent = null;
    try {
        const cookiesPath = path.resolve(process.cwd(), 'cookies.json');
        if (process.env.YOUTUBE_COOKIES) {
            const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
            agent = ytdl.createAgent(cookies);
        } else if (fs.existsSync(cookiesPath)) {
            const fileContent = fs.readFileSync(cookiesPath, 'utf8');
            const localCookies = JSON.parse(fileContent);
            agent = ytdl.createAgent(localCookies);
        }
    } catch (err) {
        console.warn('Failed to load cookies in download:', err);
    }

    try {
        const cleanName = name.replace(/[^\w\s-]/g, '').trim();

        if (hasAudio) {
            const info = await ytdl.getInfo(url, { agent: agent });
            const format = info.formats.find(f => f.itag === parseInt(itag));

            if (!format) return new NextResponse('Format not found', { status: 404 });

            const filename = cleanName + '.' + format.container;
            const headers = new Headers();
            headers.set('Content-Disposition', `attachment; filename="${filename}"`);
            headers.set('Content-Type', 'application/octet-stream');

            const videoStream = ytdl(url, {
                quality: parseInt(itag),
                agent: agent,
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.youtube.com/'
                    }
                }
            });

            // Convert Node.js stream to Web Stream for Next.js 13+ App Router
            const webStream = PassThrough.toWeb(videoStream);

            videoStream.on('error', (err) => {
                console.error('YTDL Stream Error:', err);
            });

            return new NextResponse(webStream, { headers });
        } else {
            const infoHigh = await ytdl.getInfo(url, { agent: agent });
            const videoFormat = infoHigh.formats.find(f => f.itag === parseInt(itag));

            const audioFormat = ytdl.filterFormats(infoHigh.formats, 'audioonly').find(f => f.container === 'mp4')
                || ytdl.filterFormats(infoHigh.formats, 'audioonly')[0];

            if (!videoFormat || !audioFormat) {
                return new NextResponse('Format not found', { status: 404 });
            }

            const filenameHq = cleanName + '.mp4';
            const headersHq = new Headers();
            headersHq.set('Content-Disposition', `attachment; filename="${filenameHq}"`);
            headersHq.set('Content-Type', 'video/mp4');

            const inputOptions = [
                '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '-headers', 'Referer: https://www.youtube.com/'
            ];

            const passthroughHq = new PassThrough();

            ffmpeg()
                .input(videoFormat.url)
                .inputOptions(inputOptions)
                .input(audioFormat.url)
                .inputOptions(inputOptions)
                .outputFormat('mp4')
                .videoCodec('copy')
                .audioCodec('aac')
                .on('error', function (err) {
                    console.error('FFmpeg error:', err);
                    if (!passthroughHq.closed) passthroughHq.end();
                })
                .pipe(passthroughHq, { end: true });

            const webStreamHq = PassThrough.toWeb(passthroughHq);

            return new NextResponse(webStreamHq, { headers: headersHq });
        }
    } catch (error) {
        console.error('Download System Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
