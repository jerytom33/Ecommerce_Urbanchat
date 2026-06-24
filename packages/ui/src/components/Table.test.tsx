import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table, TableColumn } from './Table';

interface TestItem {
  id: string;
  name: string;
  status: string;
}

const columns: TableColumn<TestItem>[] = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
];

const testData: TestItem[] = [
  { id: '1', name: 'Product A', status: 'Active' },
  { id: '2', name: 'Product B', status: 'Draft' },
];

describe('Table', () => {
  it('renders column headers', () => {
    render(<Table columns={columns} data={testData} keyExtractor={(item) => item.id} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
  });

  it('renders row data', () => {
    render(<Table columns={columns} data={testData} keyExtractor={(item) => item.id} />);
    expect(screen.getByText('Product A')).toBeDefined();
    expect(screen.getByText('Product B')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('shows empty message when no data', () => {
    render(<Table columns={columns} data={[]} keyExtractor={(item) => item.id} />);
    expect(screen.getByText('No data available')).toBeDefined();
  });

  it('shows custom empty message', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        keyExtractor={(item) => item.id}
        emptyMessage="Nothing to show"
      />
    );
    expect(screen.getByText('Nothing to show')).toBeDefined();
  });

  it('supports custom render function', () => {
    const columnsWithRender: TableColumn<TestItem>[] = [
      { key: 'name', header: 'Name', render: (item) => <strong>{item.name}</strong> },
      { key: 'status', header: 'Status' },
    ];
    render(<Table columns={columnsWithRender} data={testData} keyExtractor={(item) => item.id} />);
    const strongEl = screen.getByText('Product A');
    expect(strongEl.tagName).toBe('STRONG');
  });

  it('has proper table role', () => {
    render(<Table columns={columns} data={testData} keyExtractor={(item) => item.id} />);
    expect(screen.getByRole('table')).toBeDefined();
  });
});
