import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './Sidebar';

// Mock next/navigation
const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('renders all navigation items', () => {
    render(<Sidebar />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Themes')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders merchant info in the header', () => {
    render(<Sidebar />);

    expect(screen.getByText('My Store')).toBeInTheDocument();
    expect(screen.getByText('merchant@example.com')).toBeInTheDocument();
  });

  it('highlights the active navigation item', () => {
    mockPathname.mockReturnValue('/products');
    render(<Sidebar />);

    const productsLink = screen.getByText('Products').closest('a');
    expect(productsLink).toHaveAttribute('aria-current', 'page');

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });

  it('has a hamburger button for mobile that toggles sidebar', () => {
    render(<Sidebar />);

    const hamburgerBtn = screen.getByLabelText('Open navigation menu');
    expect(hamburgerBtn).toBeInTheDocument();

    // Open sidebar
    fireEvent.click(hamburgerBtn);

    // Now it should show the close button
    const closeBtn = screen.getByLabelText('Close navigation menu');
    expect(closeBtn).toBeInTheDocument();
  });

  it('renders Settings link at the bottom separated from main nav', () => {
    render(<Sidebar />);

    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('has correct navigation hrefs', () => {
    render(<Sidebar />);

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Products').closest('a')).toHaveAttribute('href', '/products');
    expect(screen.getByText('Orders').closest('a')).toHaveAttribute('href', '/orders');
    expect(screen.getByText('Customers').closest('a')).toHaveAttribute('href', '/customers');
    expect(screen.getByText('Themes').closest('a')).toHaveAttribute('href', '/themes');
    expect(screen.getByText('Marketing').closest('a')).toHaveAttribute('href', '/marketing');
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
  });

  it('has accessible navigation landmark', () => {
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
  });
});
