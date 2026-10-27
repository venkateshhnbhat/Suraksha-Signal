import React, { useState } from 'react';
import { isValidPhoneNumber } from 'libphonenumber-js';

type ContactInput = {
  name: string;
  phone: string;
  relationship: string;
};

interface Props {
  initial?: ContactInput;
  onSubmit: (data: ContactInput) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
  submitLabel?: string;
}

const ContactForm: React.FC<Props> = ({ initial, onSubmit, onCancel, disabled, submitLabel = 'Save' }) => {
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [relationship, setRelationship] = useState(initial?.relationship || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !phone) {
      setError('Name and phone are required');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setError('Invalid phone number (E.164 required)');
      return;
    }
    await onSubmit({ name, phone, relationship });
    // clear only if this is an add form (no initial)
    if (!initial) {
      setName('');
      setPhone('');
      setRelationship('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
        required
      />
      <input
        type="tel"
        placeholder="Phone (+1234567890)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
        required
      />
      <input
        type="text"
        placeholder="Relationship (optional)"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 focus:border-primary focus:outline-none"
      />
      <div className="flex space-x-2 mt-2">
        <button
          type="submit"
          disabled={disabled}
          className="flex-1 rounded bg-primary py-1 text-white hover:bg-primary/80 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded bg-gray-300 py-1 text-gray-800 hover:bg-gray-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ContactForm;
