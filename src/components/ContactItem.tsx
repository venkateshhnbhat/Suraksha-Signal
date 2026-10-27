import React from 'react';
import type { Contact } from '@/pages/ContactsPage';

interface Props {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

const ContactItem: React.FC<Props> = ({ contact, onEdit, onDelete }) => {
  return (
    <li className="flex items-center justify-between p-3 border rounded bg-gray-50">
      <div className="flex flex-col">
        <span className="font-medium">{contact.name}</span>
        <span className="text-sm text-gray-600">{contact.phone}</span>
        {contact.relationship && (
          <span className="text-xs text-gray-500">{contact.relationship}</span>
        )}
      </div>
      <div className="flex space-x-2">
        <button
          onClick={onEdit}
          className="px-2 py-1 text-sm bg-primary text-white rounded hover:bg-primary/80"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </li>
  );
};

export default ContactItem;
