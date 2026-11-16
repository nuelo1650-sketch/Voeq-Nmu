// ---------------------------------------------------------------------------
// Brand furniture — the real logo.png, everywhere, the way the roadmap's
// build standard requires: via the CSS-mask technique. The PNG is white
// lettering on transparency, so the mask takes its shape and we paint it any
// ink colour (forest on cream headers, white on forest surfaces). No img tag
// fighting its background, no recolouring the asset itself.
//
// SiteHeader / SiteFooter are the full-bleed masthead and footer shared by
// every public page — logo flush to the viewport edge, never floating near
// the centre of a narrow column.
// ---------------------------------------------------------------------------

import Link from "next/link";

// public/logo.png is the wordmark cropped tight: 137×43.
const LOGO_ASPECT = 137 / 43;

export function BrandLogo({
  color = "#0F2A1D",
  height = 24,
  className = "",
}: {
  color?: string;
  height?: number;
  className?: string;
}) {
  const mask = "url(/logo.png) center / contain no-repeat";
  return (
    <span
      role="img"
      aria-label="Voeq"
      className={`inline-block shrink-0 align-middle ${className}`}
      style={{
        height,
        width: height * LOGO_ASPECT,
        backgroundColor: color,
        WebkitMask: mask,
        mask,
      }}
    />
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-vq-forest/10 bg-white/60 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" aria-label="Voeq — home" className="flex items-center">
          <BrandLogo height={24} />
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vq-amber-dark">
          NMU Business&nbsp;Register
        </span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-vq-forest/10 py-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">
        Nigeria Maritime University · Okerenkoko &amp; Kurutie · A Voeq service · Powered by Legacylm
      </p>
    </footer>
  );
}
