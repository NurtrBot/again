'use client';
import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { COPY } from '@/src/domain/copy';
import { ArrowLeft, ArrowRight, Close, FilmIcon, PlusCircle, User } from './icons';
import { useOffline } from './use-offline';

export type Theme = 'cobalt' | 'white' | 'dark';

/* ---------- Shell ---------- */
export function Shell({
  theme = 'white',
  nav,
  wide,
  children,
  demo,
  className = '',
}: {
  theme?: Theme;
  nav?: 'create' | 'films' | 'account';
  wide?: boolean;
  children: ReactNode;
  demo?: boolean;
  className?: string;
}) {
  const offline = useOffline();
  return (
    <div className={`shell${nav ? ' shell--has-nav' : ''}${wide ? ' shell--wide' : ''} ${className}`} data-theme={theme}>
      {demo ? <DemoBanner /> : null}
      {offline ? (
        <div className="offline-banner" role="status">
          You’re offline. Nothing is sent until you’re back online.
        </div>
      ) : null}
      {children}
      {nav ? <BottomNav active={nav} theme={theme} /> : null}
    </div>
  );
}

export function DemoBanner({ text }: { text?: string }) {
  return (
    <div className="demo-banner" role="note">
      {text ?? COPY.demoBanner}
    </div>
  );
}

/** Plain header link for the right slot (e.g. "Skip", "My films"). */
export function HeaderLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} className="header-link">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className="header-link" onClick={onClick}>
      {children}
    </button>
  );
}

/* ---------- Header ---------- */
export function BrandMark({ href = '/', small }: { href?: string | null; small?: boolean }) {
  const cls = `brand${small ? ' brand--sm' : ''}`;
  if (href === null) return <span className={cls}>{COPY.brand}</span>;
  return (
    <Link href={href} className={cls} aria-label="again. home">
      {COPY.brand}
    </Link>
  );
}

export function Header({
  start,
  end,
  center = <BrandMark />,
  brandStart,
  backHref,
  onBack,
  closeHref,
  onClose,
}: {
  start?: ReactNode;
  end?: ReactNode;
  center?: ReactNode;
  brandStart?: boolean;
  backHref?: string;
  onBack?: () => void;
  closeHref?: string;
  onClose?: () => void;
}) {
  let startNode = start;
  if (!startNode && (backHref || onBack)) {
    startNode = backHref ? (
      <Link href={backHref} className="icon-btn" aria-label="Back">
        <ArrowLeft />
      </Link>
    ) : (
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
        <ArrowLeft />
      </button>
    );
  }
  let endNode = end;
  if (!endNode && (closeHref || onClose)) {
    endNode = closeHref ? (
      <Link href={closeHref} className="icon-btn" aria-label="Close">
        <Close />
      </Link>
    ) : (
      <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
        <Close />
      </button>
    );
  }
  if (brandStart) {
    return (
      <header className="header header--left">
        <div className="header__start">{center}</div>
        <div />
        <div className="header__end">{endNode}</div>
      </header>
    );
  }
  return (
    <header className="header">
      <div className="header__start">{startNode}</div>
      <div className="header__center">{center}</div>
      <div className="header__end">{endNode}</div>
    </header>
  );
}

export function CreditPill({ credits, href = '/credits', boxed = true }: { credits: number; href?: string; boxed?: boolean }) {
  return (
    <Link href={href} className={boxed ? 'credit-pill' : 'credit-text'} aria-label={`${COPY.credits(credits)} available. Buy credits`}>
      {COPY.credits(credits)}
    </Link>
  );
}

/* ---------- Bottom nav ---------- */
export function BottomNav({ active, theme }: { active: 'create' | 'films' | 'account'; theme?: Theme }) {
  const items = [
    { key: 'create', href: '/create', label: COPY.nav.create, icon: <PlusCircle /> },
    { key: 'films', href: '/films', label: COPY.nav.films, icon: <FilmIcon /> },
    { key: 'account', href: '/account', label: COPY.nav.account, icon: <User /> },
  ] as const;
  return (
    <nav className={`bottom-nav${theme === 'cobalt' ? ' bottom-nav--cobalt' : ''}`} aria-label="Primary">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className="bottom-nav__item" aria-current={it.key === active ? 'page' : undefined}>
          {it.icon}
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Buttons ---------- */
type Variant = 'primary' | 'outline' | 'outline-cobalt' | 'danger-outline' | 'black' | 'white-outline';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  arrow?: boolean;
  icon?: ReactNode;
  pending?: boolean;
  size?: 'md' | 'sm';
  href?: string;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', arrow, icon, pending, size = 'md', href, children, className = '', disabled, ...rest },
  ref,
) {
  const cls = `btn btn--${variant}${arrow ? ' btn--with-end' : ''}${size === 'sm' ? ' btn--sm' : ''} ${className}`;
  const inner = (
    <>
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span>{children}</span>
      {arrow ? <span className="btn__end">{pending ? <span className="btn__spinner" /> : <ArrowRight />}</span> : null}
      {!arrow && pending ? <span className="btn__spinner" /> : null}
    </>
  );
  if (href && !disabled && !pending) {
    return (
      <Link href={href} className={cls} {...(rest as object)}>
        {inner}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className={cls} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {inner}
    </button>
  );
});

/* ---------- Viewfinder ---------- */
export function Viewfinder({
  color = 'white',
  size,
  inset0,
  className = '',
  children,
}: {
  color?: 'white' | 'cobalt';
  size?: 'lg';
  inset0?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`viewfinder viewfinder--${color}${size ? ` viewfinder--${size}` : ''}${inset0 ? ' viewfinder--inset0' : ''} ${className}`}>
      {children}
      <span className="viewfinder__corner viewfinder__corner--tl" />
      <span className="viewfinder__corner viewfinder__corner--tr" />
      <span className="viewfinder__corner viewfinder__corner--bl" />
      <span className="viewfinder__corner viewfinder__corner--br" />
    </div>
  );
}

export function Corners() {
  return (
    <>
      <span className="viewfinder__corner viewfinder__corner--tl" />
      <span className="viewfinder__corner viewfinder__corner--tr" />
      <span className="viewfinder__corner viewfinder__corner--bl" />
      <span className="viewfinder__corner viewfinder__corner--br" />
    </>
  );
}

/* ---------- Photo ---------- */
export function Photo({
  src,
  alt,
  ratio = '4/3',
  enter,
  children,
  className = '',
  style,
}: {
  src: string | null;
  alt: string;
  ratio?: string;
  enter?: boolean;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`photo photo--auto${enter ? ' photo--enter' : ''} ${className}`} style={{ ['--ar' as string]: ratio, ...style }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
      ) : null}
      {children}
    </div>
  );
}

export function ratioOf(w?: number | null, h?: number | null, fallback = '4/3'): string {
  if (!w || !h) return fallback;
  return `${w}/${h}`;
}
