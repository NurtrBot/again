import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell" data-theme="white">
      <header className="header">
        <div className="header__start" />
        <div className="header__center">
          <Link href="/" className="brand" aria-label="again. home">
            again.
          </Link>
        </div>
        <div className="header__end" />
      </header>
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 40 }}>
          We can’t find that.
        </h1>
        <p className="lead" style={{ marginTop: 12 }}>
          The page may have moved, or it isn’t yours to see.
        </p>
        <Link href="/films" className="btn btn--primary" style={{ marginTop: 28 }}>
          Back to My films
        </Link>
      </div>
    </div>
  );
}
