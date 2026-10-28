import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Contact } from '@/types';

interface Props {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

const ContactItem: React.FC<Props> = ({ contact, onEdit, onDelete }) => {
  const { t } = useTranslation();

  return (
    <li className="flex items-center justify-between p-3.5 border border-slate-800 rounded-xl bg-slate-900/90 hover:border-slate-700 transition">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 text-sm">{contact.name}</span>
          {contact.confirmed ? (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
              {t('contacts.verified')}
            </span>
          ) : (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
              {t('contacts.pending')}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-teal-400 mt-0.5">{contact.phone}</span>
        {contact.relationship && (
          <span className="text-[11px] text-slate-400 mt-0.5">{contact.relationship}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`tel:${contact.phone}`}
          className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg border border-slate-700 transition"
          title={t('contacts.call')}
        >
          {t('contacts.call')}
        </a>
        <button
          onClick={onEdit}
          className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
        >
          {t('contacts.edit')}
        </button>
        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 text-xs bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-lg border border-red-800/40 transition"
        >
          {t('contacts.delete')}
        </button>
      </div>
    </li>
  );
};

export default ContactItem;
