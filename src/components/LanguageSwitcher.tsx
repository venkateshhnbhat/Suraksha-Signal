import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/i18n';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLang = e.target.value as SupportedLanguage;
    i18n.changeLanguage(nextLang);
  };

  return (
    <div className="relative inline-flex items-center">
      <span className="text-xs mr-1.5 opacity-70">🌐</span>
      <select
        value={i18n.language}
        onChange={handleLanguageChange}
        aria-label="Select Language"
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-1 px-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer transition shadow-sm"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
