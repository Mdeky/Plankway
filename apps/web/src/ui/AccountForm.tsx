import { useMemo, useState } from 'preact/hooks';
import { COUNTRIES, NAME_MAX, normalizeDisplayName } from '@bridgle/core';
import { updateAccount, type Account } from '../game/api.ts';
import { getLang, t, type MessageKey } from '../i18n.ts';

/** Name and country, shown on the leaderboards. */
export function AccountForm({ account, notice, onSaved }: { account: Account; notice?: MessageKey | null; onSaved(account: Account): void }) {
  const [name, setName] = useState(account.displayName ?? '');
  const [country, setCountry] = useState(account.country ?? '');
  const [message, setMessage] = useState<MessageKey | null>(notice ?? null);
  const [busy, setBusy] = useState(false);

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([getLang()], { type: 'region' });
    } catch {
      // Very old browsers: show the codes.
    }
    return COUNTRIES.map((code) => ({ code, label: names?.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label, getLang()));
  }, []);

  const cleanName = normalizeDisplayName(name);
  const changed = (cleanName ?? name) !== (account.displayName ?? '') || country !== (account.country ?? '');

  const save = async (ev: Event) => {
    ev.preventDefault();
    if (!cleanName) {
      setMessage('account.error.invalid-name');
      return;
    }
    setBusy(true);
    const res = await updateAccount({ displayName: cleanName, country: country || null });
    setBusy(false);
    if (res.ok) {
      setName(res.displayName ?? '');
      setMessage('account.saved');
      onSaved({ ...account, displayName: res.displayName, country: res.country });
    } else {
      setMessage(errorKey(res.error));
    }
  };

  return (
    <form class="profile-form" onSubmit={save}>
      <label class="field">
        <span>{t('account.name')}</span>
        <input
          value={name}
          maxLength={NAME_MAX}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          autocomplete="nickname"
          spellcheck={false}
        />
        <small class="muted">{t('account.nameHelp')}</small>
      </label>
      <label class="field">
        <span>{t('account.country')}</span>
        <select value={country} onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}>
          <option value="">{t('account.noCountry')}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <button class="btn primary" type="submit" disabled={busy || !changed}>
        {t('account.save')}
      </button>
      {message && (
        <p class="status" role="status">
          {t(message)}
        </p>
      )}
    </form>
  );
}

function errorKey(error: string): MessageKey {
  switch (error) {
    case 'invalid-name':
    case 'name-not-allowed':
    case 'invalid-country':
    case 'rate-limited':
      return `account.error.${error}`;
    default:
      return 'account.error.offline';
  }
}
