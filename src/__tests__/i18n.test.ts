import { describe, it, expect } from 'vitest';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

describe('i18n Internationalization', () => {
  it('registers English, Hindi, and Kannada supported languages', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('kn');
  });

  it('translates brand and emergency panic keys in English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('brand.name')).toBe('Suraksha Signal');
    expect(i18n.t('hero.panicTitle')).toBe('Emergency Panic Button');
    expect(i18n.t('contacts.title')).toBe('Emergency Contacts');
  });

  it('translates brand and emergency keys in Hindi', async () => {
    await i18n.changeLanguage('hi');
    expect(i18n.t('brand.name')).toBe('सुरक्षा सिग्नल');
    expect(i18n.t('hero.panicTitle')).toBe('आपातकालीन पैनिक बटन');
    expect(i18n.t('contacts.title')).toBe('आपातकालीन संपर्क');
  });

  it('translates brand and emergency keys in Kannada', async () => {
    await i18n.changeLanguage('kn');
    expect(i18n.t('brand.name')).toBe('ಸುರಕ್ಷಾ ಸಿಗ್ನಲ್');
    expect(i18n.t('hero.panicTitle')).toBe('ತುರ್ತು ಪ್ಯಾನಿಕ್ ಬಟನ್');
    expect(i18n.t('contacts.title')).toBe('ತುರ್ತು ಸಂಪರ್ಕಗಳು');
  });
});
