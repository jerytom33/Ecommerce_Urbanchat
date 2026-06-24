import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeDefined();
  });

  it('applies padding classes', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    expect(container.firstElementChild?.className).toContain('p-6');
  });

  it('applies no padding when padding is none', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    expect(container.firstElementChild?.className).not.toContain('p-');
  });

  it('passes custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstElementChild?.className).toContain('custom-class');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeDefined();
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content body</CardContent>);
    expect(screen.getByText('Content body')).toBeDefined();
  });
});
