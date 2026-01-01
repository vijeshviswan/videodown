'use client';

import { useState } from 'react';
import { Search, Download, AlertCircle } from 'lucide-react';
import styles from './Downloader.module.css';

export default function Downloader() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const res = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const json = await res.json();

            if (!res.ok) {
                // If it's a 500 error from our API, it might contain debug info
                if (json.debug) {
                    setData({ debug: json.debug }); // Store debug info even if failed
                }
                throw new Error(json.error || 'Failed to fetch info');
            }

            setData(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.wrapper}>
            <form onSubmit={handleAnalyze} className={styles.inputGroup}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Paste YouTube URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <button type="submit" className={`btn btn-primary ${styles.analyzeBtn}`} disabled={loading}>
                    {loading ? 'Analyzing...' : <><Search size={20} style={{ marginRight: '0.5rem' }} /> Analyze</>}
                </button>
            </form>

            {error && (
                <div className={styles.error}>
                    <AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    <strong>Error:</strong> {error}

                    {data?.debug && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.9, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '0.5rem' }}>
                            <strong>Debug Info:</strong><br />
                            Cookies Loaded: {data.debug.cookiesLoaded ? '✅ Yes' : '❌ No'}<br />
                            Source: {data.debug.authSource.toUpperCase()}<br />
                            {data.debug.cookieError && <span style={{ color: '#ffaaaa' }}>Cookie Error: {data.debug.cookieError}</span>}
                        </div>
                    )}
                </div>
            )}

            {loading && <div className={styles.loader}></div>}

            {data && (
                <div className={`card ${styles.videoCard}`}>
                    <img src={data.thumbnail} alt={data.title} className={styles.thumbnail} />

                    <div className={styles.info}>
                        <h2>{data.title}</h2>
                        <div className={styles.meta}>
                            <span>⏱ {formatDuration(data.duration)}</span>
                            <span>ID: {data.videoId}</span>
                        </div>

                        <div className={styles.formats}>
                            <div className={styles.formatSection}>
                                <h3>Video</h3>
                                <div className={styles.grid}>
                                    {data.formats.filter(f => f.type === 'video').map((f, i) => (
                                        <a
                                            key={i}
                                            href={`/api/download?url=${encodeURIComponent(url)}&itag=${f.itag}&name=${encodeURIComponent(data.title)}&hasAudio=${f.hasAudio}`}
                                            className={styles.formatBtn}
                                            target="_blank"
                                        >
                                            <span className={styles.quality}>{f.quality}</span>
                                            <span className={styles.formatMeta}>{f.container.toUpperCase()}</span>
                                            {!f.hasAudio && <span className={styles.badge}>HQ+Merge</span>}
                                            <Download size={16} style={{ marginTop: '0.2rem' }} />
                                        </a>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formatSection}>
                                <h3>Audio</h3>
                                <div className={styles.grid}>
                                    {data.formats.filter(f => f.type === 'audio').map((f, i) => (
                                        <a
                                            key={i}
                                            href={`/api/download?url=${encodeURIComponent(url)}&itag=${f.itag}&name=${encodeURIComponent(data.title)}`}
                                            className={styles.formatBtn}
                                            target="_blank"
                                        >
                                            <span className={styles.quality}>Audio</span>
                                            <span className={styles.formatMeta}>{f.container.toUpperCase()}</span>
                                            <Download size={16} style={{ marginTop: '0.2rem' }} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
