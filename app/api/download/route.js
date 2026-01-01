import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath);

export async function GET(request) {
    var searchParams = new URL(request.url).searchParams;
    var url = searchParams.get('url');
    var itag = searchParams.get('itag');
    var name = searchParams.get('name') || 'video';
    var hasAudio = searchParams.get('hasAudio') !== 'false';

    if (!url || !itag) {
        return new NextResponse('Missing parameters', { status: 400 });
    }

    var agent = null;
    try {
        var cookiesPath = path.resolve(process.cwd(), 'cookies.json');
        if (process.env.YOUTUBE_COOKIES) {
            var cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
            agent = ytdl.createAgent(cookies);
        } else if (fs.existsSync(cookiesPath)) {
            var fileContent = fs.readFileSync(cookiesPath, 'utf8');
            var localCookies = JSON.parse(fileContent);
            agent = ytdl.createAgent(localCookies);
        }
    } catch (err) {
        console.warn('Failed to load cookies in download:', err);
    }

    try {
        var cleanName = name.replace(/[^\w\s-]/g, '').trim();

        if (hasAudio) {
            var info = await ytdl.getInfo(url, { agent: agent });
            var format = null;
            for (var i = 0; i < info.formats.length; i++) {
                if (info.formats[i].itag === parseInt(itag)) {
                    format = info.formats[i];
                    break;
                }
            }
            if (!format) return new NextResponse('Format not found', { status: 404 });

            var filename = cleanName + '.' + format.container;
            var headers = new Headers();
            headers.set('Content-Disposition', 'attachment; filename="' + filename + '"');
            headers.set('Content-Type', 'application/octet-stream');

            var passthrough = new PassThrough();
            var videoStream = ytdl(url, { quality: parseInt(itag), agent: agent });
            videoStream.pipe(passthrough);

            return new NextResponse(passthrough, { headers: headers });
        } else {
            var infoHigh = await ytdl.getInfo(url, { agent: agent });
            var videoFormat = null;
            for (var j = 0; j < infoHigh.formats.length; j++) {
                if (infoHigh.formats[j].itag === parseInt(itag)) {
                    videoFormat = infoHigh.formats[j];
                    break;
                }
            }

            var audioFormat = ytdl.filterFormats(infoHigh.formats, 'audioonly').find(function (f) {
                return f.container === 'mp4';
            }) || ytdl.filterFormats(infoHigh.formats, 'audioonly')[0];

            if (!videoFormat || !audioFormat) {
                return new NextResponse('Format not found', { status: 404 });
            }

            var filenameHq = cleanName + '.mp4';
            var headersHq = new Headers();
            headersHq.set('Content-Disposition', 'attachment; filename="' + filenameHq + '"');
            headersHq.set('Content-Type', 'video/mp4');

            var inputOptions = [
                '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '-headers', 'Referer: https://www.youtube.com/'
            ];

            var passthroughHq = new PassThrough();

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

            return new NextResponse(passthroughHq, { headers: headersHq });
        }
    } catch (error) {
        console.error('Download System Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
