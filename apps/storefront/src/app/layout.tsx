import type { Metadata, Viewport } from 'next';
import React, { Suspense } from 'react';
import { ThemeStyles, getActiveTheme } from '../lib/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Storefront - E-commerce Platform',
  description: 'Customer-facing storefront with fast, streaming server-side rendering',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
};

/**
 * Root Layout - Streaming SSR with Next.js App Router.
 * The header renders immediately (above-the-fold) for fast LCP.
 * Theme CSS variables are injected server-side for zero-JS branding.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.5, 4.2
 */
export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.ReactElement> {
  const theme = await getActiveTheme();

  return (
    <html lang="en">
      <head>
        <ThemeStyles />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-text font-sans antialiased">
        {/* Above-the-fold header renders immediately (no Suspense) for fast LCP */}
        <Header storeName={theme.storeName} logo={theme.logo} navLinks={theme.navigation.links} />

        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer streams in via Suspense for progressive rendering */}
        <Suspense fallback={<FooterSkeleton />}>
          <Footer
            storeName={theme.storeName}
            description={theme.footer.description}
            links={theme.footer.links}
            socialLinks={theme.footer.socialLinks}
          />
        </Suspense>
      </body>
    </html>
  );
}

/**
 * Responsive header with store branding, navigation, cart, and account.
 * Includes mobile hamburger menu for screens < md breakpoint.
 */
function Header({
  storeName,
  logo,
  navLinks,
}: {
  storeName: string;
  logo?: string;
  navLinks: Array<{ label: string; href: string }>;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo / Store Name */}
        <a href="/" className="flex items-center gap-2" aria-label={`${storeName} home`}>
          {logo ? (
            <img src={logo} alt={`${storeName} logo`} className="h-8 w-auto" width={32} height={32} />
          ) : (
            <span className="text-xl font-bold text-primary">{storeName}</span>
          )}
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions: Search, Account, Cart */}
        <div className="flex items-center gap-4">
          {/* Search icon (desktop) */}
          <a
            href="/search"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface transition-colors"
            aria-label="Search products"
          >
            <SearchIcon />
          </a>

          {/* Account link */}
          <a
            href="/account"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface transition-colors"
            aria-label="My account"
          >
            <UserIcon />
          </a>

          {/* Cart with item count badge */}
          <a
            href="/cart"
            className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface transition-colors"
            aria-label="Shopping cart"
          >
            <CartIcon />
            {/* Cart badge - rendered server-side, updated via client component in future task */}
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary rounded-full">
              0
            </span>
          </a>

          {/* Mobile hamburger menu */}
          <MobileMenuButton navLinks={navLinks} />
        </div>
      </div>
    </header>
  );
}

/**
 * Mobile menu button using CSS-only :target pattern for zero-JS progressive enhancement.
 * A full client-side mobile menu will be implemented in a subsequent interactive task.
 */
function MobileMenuButton({ navLinks }: { navLinks: Array<{ label: string; href: string }> }) {
  return (
    <div className="md:hidden">
      <a
        href="#mobile-menu"
        className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface transition-colors"
        aria-label="Open menu"
        aria-expanded="false"
      >
        <HamburgerIcon />
      </a>

      {/* Mobile menu overlay - accessible via #mobile-menu anchor */}
      <div
        id="mobile-menu"
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm hidden target:flex flex-col"
        role="dialog"
        aria-label="Mobile navigation"
      >
        <div className="bg-background border-b border-border p-4">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg font-bold text-primary">Menu</span>
            <a
              href="#"
              className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface transition-colors"
              aria-label="Close menu"
            >
              <CloseIcon />
            </a>
          </div>
          <nav className="flex flex-col gap-4" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-base font-medium text-text hover:text-primary transition-colors py-2 border-b border-border"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/account"
              className="text-base font-medium text-text hover:text-primary transition-colors py-2 border-b border-border"
            >
              My Account
            </a>
            <a
              href="/search"
              className="text-base font-medium text-text hover:text-primary transition-colors py-2"
            >
              Search
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Footer with store info, quick links, and social media placeholders.
 */
function Footer({
  storeName,
  description,
  links,
  socialLinks,
}: {
  storeName: string;
  description: string;
  links: Array<{ label: string; href: string }>;
  socialLinks: Array<{ platform: string; url: string }>;
}) {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Store Info */}
          <div>
            <h3 className="text-lg font-bold text-text mb-3">{storeName}</h3>
            <p className="text-sm text-muted leading-relaxed">{description}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-3">Quick Links</h3>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-3">Follow Us</h3>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.platform}
                  href={social.url}
                  className="flex items-center justify-center w-9 h-9 rounded-md bg-background border border-border hover:border-primary hover:text-primary transition-colors"
                  aria-label={`Follow on ${social.platform}`}
                >
                  <SocialIcon platform={social.platform} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterSkeleton() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-pulse">
          <div className="space-y-3">
            <div className="h-6 w-32 bg-border rounded" />
            <div className="h-4 w-full bg-border rounded" />
            <div className="h-4 w-3/4 bg-border rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-24 bg-border rounded" />
            <div className="h-4 w-20 bg-border rounded" />
            <div className="h-4 w-28 bg-border rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-24 bg-border rounded" />
            <div className="flex gap-3">
              <div className="w-9 h-9 bg-border rounded-md" />
              <div className="w-9 h-9 bg-border rounded-md" />
              <div className="w-9 h-9 bg-border rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── SVG Icons ─── */

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  // Simple first-letter placeholder for social icons
  return (
    <span className="text-xs font-bold" aria-hidden="true">
      {platform.charAt(0).toUpperCase()}
    </span>
  );
}
