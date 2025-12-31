import Downloader from '@/components/Downloader';

export default function Home() {
  return (
    <main className="container" style={{ paddingTop: '8vh', paddingBottom: '4rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
        YouTube <span className="gradient-text">Downloader</span>
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#888', marginBottom: '4rem', maxWidth: '600px', margin: '0 auto 4rem auto' }}>
        Download your favorite videos in highest quality. Fully free, fast, and secure.
      </p>

      <Downloader />
    </main>
  );
}
