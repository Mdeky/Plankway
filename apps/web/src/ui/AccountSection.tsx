import { useEffect, useMemo, useState } from 'preact/hooks';
import { COUNTRIES, NAME_MAX, normalizeDisplayName } from '@bridgle/core';
import { fetchMe, fetchProviders, signInUrl, updateAccount, type Account } from '../game/api.ts';
import { signOutDevice } from '../game/sync.ts';
import { getLang, t, type MessageKey } from '../i18n.ts';
import { FriendsSection } from './FriendsSection.tsx';

type State = { kind: 'loading' } | { kind: 'offline' } | { kind: 'guest'; providers: string[] } | { kind: 'account'; account: Account };

const PROVIDER_LABEL: Record<string, MessageKey> = { google: 'account.google' };

/** Sign in (to keep progress on every device), then pick a name and country for leaderboards. */
export function AccountSection({ onSignedOut, notice }: { onSignedOut(): void; notice?: MessageKey | null }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(notice ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([fetchMe(), fetchProviders()]).then(([me, providers]) => {
      if (!live) return;
      if (me?.account) {
        setState({ kind: 'account', account: me.account });
        setName(me.account.displayName ?? '');
        setCountry(me.account.country ?? '');
        // Already able to accept an invite: the friends section handles it and says so.
        if (me.account.displayName && notice === 'friends.invited') setMessage(null);
      } else if (providers.length > 0) {
        setState({ kind: 'guest', providers });
      } else {
        setState({ kind: 'offline' });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([getLang()], { type: 'region' });
    } catch {
      // Very old browsers: show the codes.
    }
    return COUNTRIES.map((code) => ({ code, label: names?.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label, getLang()));
  }, []);

  if (state.kind === 'loading' || state.kind === 'offline') return null;

  if (state.kind === 'guest') {
    return (
      <section class="profile-section">
        <h3>{t('account.title')}</h3>
        <p class="muted">{t('account.intro')}</p>
        {state.providers.map((p) => (
          <a key={p} class="btn primary" href={signInUrl(p)}>
            {t(PROVIDER_LABEL[p] ?? 'account.google')}
          </a>
        ))}
        {message && (
          <p class="status" role="status">
            {t(message)}
          </p>
        )}
      </section>
    );
  }

  const cleanName = normalizeDisplayName(name);
  const changed = (cleanName ?? name) !== (state.account.displayName ?? '') || country !== (state.account.country ?? '');

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
      setState({ kind: 'account', account: { ...state.account, displayName: res.displayName, country: res.country } });
      setName(res.displayName ?? '');
      setMessage('account.saved');
    } else {
      setMessage(errorKey(res.error));
    }
  };

  const leave = async () => {
    setBusy(true);
    const ok = await signOutDevice();
    setBusy(false);
    if (ok) onSignedOut();
    else setMessage('account.error.offline');
  };

  return (
    <>
      <form class="profile-section" onSubmit={save}>
        <h3>{t('account.title')}</h3>
        <p class="muted">{t('account.signedIn')}</p>
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
        <div class="dialog-actions">
          <button class="btn" type="button" onClick={leave} disabled={busy}>
            {t('account.signOut')}
          </button>
          <button class="btn primary" type="submit" disabled={busy || !changed}>
            {t('account.save')}
          </button>
        </div>
        <p class="muted">{t('account.signOutHelp')}</p>
        {message && (
          <p class="status" role="status">
            {t(message)}
          </p>
        )}
      </form>
      {/* Friends need a name, so both sides know who they're adding. */}
      {state.account.displayName && <FriendsSection />}
    </>
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
