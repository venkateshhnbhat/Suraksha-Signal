import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactForm from '../components/ContactForm';
import '@/i18n';

describe('ContactForm Component', () => {
  it('renders input fields and submit button', () => {
    const handleSubmit = vi.fn();
    render(<ContactForm onSubmit={handleSubmit} />);

    expect(screen.getByPlaceholderText(/Rahul Sharma/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/9876543210/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Sister/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to Emergency Contacts/i })).toBeInTheDocument();
  });

  it('validates empty inputs and displays error', async () => {
    const handleSubmit = vi.fn();
    render(<ContactForm onSubmit={handleSubmit} />);

    // In JSDOM with HTML5 form, bypass native form validation to test JS error fallback
    const form = screen.getByRole('button', { name: /Add to Emergency Contacts/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  it('rejects invalid phone numbers with error message', async () => {
    const handleSubmit = vi.fn();
    render(<ContactForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Rahul Sharma/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: 'not-a-number' } });

    const form = screen.getByRole('button', { name: /Add to Emergency Contacts/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/valid phone number with country code/i)).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  it('accepts national emergency number 112 directly', async () => {
    const handleSubmit = vi.fn();
    render(<ContactForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Rahul Sharma/i), { target: { value: 'Emergency Services' } });
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: '112' } });

    const form = screen.getByRole('button', { name: /Add to Emergency Contacts/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: 'Emergency Services',
        phone: '112',
        relationship: ''
      });
    });
  });

  it('submits valid international phone number successfully', async () => {
    const handleSubmit = vi.fn();
    render(<ContactForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Rahul Sharma/i), { target: { value: 'Ravi Kumar' } });
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Sister/i), { target: { value: 'Brother' } });

    const form = screen.getByRole('button', { name: /Add to Emergency Contacts/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: 'Ravi Kumar',
        phone: '+919876543210',
        relationship: 'Brother'
      });
    });
  });
});
