import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  it('renders without label', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeDefined();
  });

  it('displays error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Invalid email')).toBeDefined();
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
  });

  it('displays helper text', () => {
    render(<Input label="Name" helperText="Your full name" />);
    expect(screen.getByText('Your full name')).toBeDefined();
  });

  it('does not show helper text when error is present', () => {
    render(<Input label="Name" helperText="Your full name" error="Required" />);
    expect(screen.queryByText('Your full name')).toBeNull();
  });

  it('applies error border style when error is present', () => {
    render(<Input label="Email" error="Invalid" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-error');
  });
});
