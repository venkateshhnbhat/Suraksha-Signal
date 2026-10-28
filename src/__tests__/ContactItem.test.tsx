import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactItem from '../components/ContactItem';
import type { Contact } from '@/types';
import '@/i18n';

describe('ContactItem Component', () => {
  const dummyContact: Contact = {
    id: 'c1',
    name: 'Priya Sharma',
    phone: '+919876543210',
    relationship: 'Sister',
    confirmed: true,
    createdAt: new Date().toISOString()
  };

  it('renders contact details and verified badge', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(<ContactItem contact={dummyContact} onEdit={handleEdit} onDelete={handleDelete} />);

    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('+919876543210')).toBeInTheDocument();
    expect(screen.getByText('Sister')).toBeInTheDocument();
    expect(screen.getByText(/Verified/i)).toBeInTheDocument();
  });

  it('renders pending badge when confirmed is false', () => {
    const pendingContact = { ...dummyContact, confirmed: false };
    render(<ContactItem contact={pendingContact} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText(/Pending confirmation/i)).toBeInTheDocument();
  });

  it('calls onEdit and onDelete handlers', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(<ContactItem contact={dummyContact} onEdit={handleEdit} onDelete={handleDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    expect(handleEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
