import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    var agent = null;
    var cookieError = null;

    try {
        var body = await request.json();
        var url = body.url;

        if (!url || !ytdl.validateURL(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        // Cookie Loading Logic
        try {
            var cookies = null;
            var cookiesPath = path.resolve(process.cwd(), 'cookies.json');

            if (process.env.YOUTUBE_COOKIES) {
                cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
            } else if (fs.existsSync(cookiesPath)) {
                var fileContent = fs.readFileSync(cookiesPath, 'utf8');
                cookies = JSON.parse(fileContent);
            }

            if (cookies) {
                if (!Array.isArray(cookies)) {
                    throw new Error('Cookies must be a JSON Array');
                }
                agent = ytdl.createAgent(cookies);
            }
        } catch (err) {
            console.warn('Failed to load cookies:', err);
            cookieError = err.message;
        }

        var info = await ytdl.getInfo(url, { agent: agent });

        var mixed = ytdl.filterFormats(info.formats, 'videoandaudio');
        var videoOnly = ytdl.filterFormats(info.formats, 'videoonly').filter(function (f) { return f.height >= 1080; });
        var audioOnly = ytdl.filterFormats(info.formats, 'audioonly');

        mixed.sort(function (a, b) { return (b.height || 0) - (a.height || 0); });
        videoOnly.sort(function (a, b) { return (b.height || 0) - (a.height || 0); });

        var formats = [];

        for (var i = 0; i < mixed.length; i++) {
            var f = mixed[i];
            formats.push({
                itag: f.itag,
                quality: f.qualityLabel,
                container: f.container,
                type: 'video',
                hasAudio: true
            });
        }

        for (var j = 0; j < videoOnly.length; j++) {
            var fv = videoOnly[j];
            formats.push({
                itag: fv.itag,
                quality: fv.qualityLabel,
                container: fv.container,
                type: 'video',
                hasAudio: false
            });
        }

        for (var k = 0; k < audioOnly.length; k++) {
            var fa = audioOnly[k];
            formats.push({
                itag: fa.itag,
                quality: 'Audio',
                container: fa.container,
                type: 'audio',
                hasAudio: true
            });
        }

        var payload = {
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
            duration: info.videoDetails.lengthSeconds,
            videoId: info.videoDetails.videoId,
            formats: formats
        };

        return NextResponse.json(payload);

    } catch (error) {
        console.error('YTDL Error:', error);

        var debug = {
            cookiesLoaded: agent !== null,
            authSource: process.env.YOUTUBE_COOKIES ? 'env' : 'file/none',
            cookieError: cookieError,
            errorMsg: error.message
        };

        return NextResponse.json({
            error: 'Failed to fetch video info. ' + error.message,
            debug: debug
        }, { status: 500 });
    }
}
