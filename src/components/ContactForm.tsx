import React, { useState } from 'react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';

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

const ContactForm: React.FC<Props> = ({ initial, onSubmit, onCancel, disabled, submitLabel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [relationship, setRelationship] = useState(initial?.relationship || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError(t('form.requiredError'));
      return;
    }

    const cleanPhone = phone.trim();
    const isSpecialNumber = cleanPhone === '112' || cleanPhone === '911' || cleanPhone === '999';
    let normalizedPhone = cleanPhone;

    if (!isSpecialNumber) {
      try {
        const parsed = parsePhoneNumber(cleanPhone, 'IN');
        if (!parsed || !parsed.isValid()) {
          setError(t('form.invalidPhone'));
          return;
        }
        normalizedPhone = parsed.number; // Canonical E.164 (e.g. +919876543210)
      } catch {
        // Fallback check
        if (!isValidPhoneNumber(cleanPhone, 'IN')) {
          setError(t('form.invalidPhone'));
          return;
        }
      }
    }

    await onSubmit({ name: name.trim(), phone: normalizedPhone, relationship: relationship.trim() });
    if (!initial) {
      setName('');
      setPhone('');
      setRelationship('');
    }
  };

  const finalSubmitLabel = submitLabel || (initial ? t('form.saveBtn') : t('form.addBtn'));

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-red-300 bg-red-950/50 border border-red-800/60 p-2.5 rounded-xl text-xs">
          ⚠️ {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('form.nameLabel')}
        </label>
        <input
          type="text"
          placeholder={t('form.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
          required
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('form.phoneLabel')}
        </label>
        <input
          type="tel"
          placeholder={t('form.phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
          required
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('form.relLabel')}
        </label>
        <input
          type="text"
          placeholder={t('form.relPlaceholder')}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="flex-1 py-2 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs transition duration-150 shadow-md shadow-teal-500/20 disabled:opacity-50"
        >
          {finalSubmitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
          >
            {t('contacts.cancel')}
          </button>
        )}
      </div>
    </form>
  );
};

export default ContactForm;
