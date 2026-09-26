import { useEffect, useState } from 'preact/hooks';
import {
  addFriend,
  fetchFriends,
  formatFriendCode,
  inviteLink,
  pendingFriendCode,
  removeFriend,
  renewFriendCode,
  setPendingFriendCode,
  type FriendsReply,
  type FriendsView,
} from '../game/api.ts';
import { shareResult } from '../game/share.ts';
import { t, type MessageKey } from '../i18n.ts';

type Message = { key: MessageKey; name?: string };

const ERRORS: Record<string, MessageKey> = {
  'invalid-code': 'friends.error.invalid-code',
  'unknown-code': 'friends.error.unknown-code',
  self: 'friends.error.self',
  'too-many': 'friends.error.too-many',
  'rate-limited': 'friends.error.rate-limited',
};

/** Your friend code and invite link, adding friends by code, and your friends list. */
export function FriendsSection() {
  const [view, setView] = useState<FriendsView | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);

  const apply = (reply: FriendsReply, success?: Message) => {
    if (reply.ok) {
      setView(reply.view);
      if (reply.added) setMessage({ key: reply.already ? 'friends.already' : 'friends.added', name: reply.added.name });
      else if (success) setMessage(success);
    } else {
      setMessage({ key: ERRORS[reply.error] ?? 'account.error.offline' });
    }
    return reply.ok;
  };

  useEffect(() => {
    void (async () => {
      const first = await fetchFriends();
      if (!first.ok) return apply(first);
      setView(first.view);
      // Opened through an invite link: add that friend now that we can.
      const pending = pendingFriendCode();
      if (pending) {
        setPendingFriendCode(null);
        apply(await addFriend(pending));
      }
    })();
  }, []);

  if (!view) {
    return message ? (
      <section class="profile-section">
        <h3>{t('friends.title')}</h3>
        <p class="status">{t(message.key)}</p>
      </section>
    ) : null;
  }

  const add = async (ev: Event) => {
    ev.preventDefault();
    setBusy(true);
    const ok = apply(await addFriend(code));
    setBusy(false);
    if (ok) setCode('');
  };

  const invite = async () => {
    const link = inviteLink(view.code);
    const outcome = await shareResult(`${t('friends.inviteText')}\n${link}`);
    setMessage({ key: outcome === 'copied' ? 'friends.linkCopied' : outcome === 'failed' ? 'share.failed' : 'friends.linkShared' });
  };

  return (
    <section class="profile-section">
      <h3>{t('friends.title')}</h3>
      <p class="muted">{t('friends.intro')}</p>
      <p class="friend-code" translate={false} aria-label={t('friends.yourCode')}>
        {formatFriendCode(view.code)}
      </p>
      <div class="dialog-actions">
        <button class="btn primary" type="button" onClick={invite}>
          {t('friends.invite')}
        </button>
        <button class="btn" type="button" onClick={() => setConfirmRenew(true)} disabled={busy}>
          {t('friends.renew')}
        </button>
      </div>
      {confirmRenew && (
        <div class="friends-confirm">
          <p>{t('friends.renewConfirm')}</p>
          <div class="dialog-actions">
            <button class="btn" type="button" onClick={() => setConfirmRenew(false)}>
              {t('common.cancel')}
            </button>
            <button
              class="btn primary"
              type="button"
              onClick={async () => {
                setConfirmRenew(false);
                setBusy(true);
                apply(await renewFriendCode(), { key: 'friends.renewed' });
                setBusy(false);
              }}
            >
              {t('friends.renew')}
            </button>
          </div>
        </div>
      )}

      <form class="friends-add" onSubmit={add}>
        <label class="field">
          <span>{t('friends.addLabel')}</span>
          <input
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            placeholder="K7M2-QX9P"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            maxLength={12}
          />
        </label>
        <button class="btn" type="submit" disabled={busy || code.replace(/[\s-]/g, '').length !== 8}>
          {t('friends.add')}
        </button>
      </form>

      {view.friends.length === 0 ? (
        <p class="muted">{t('friends.none')}</p>
      ) : (
        <ul class="friends-list">
          {view.friends.map((f) => (
            <li key={f.key}>
              <span class="board-name">{f.name}</span>
              {f.country && <span class="board-country">{f.country}</span>}
              <button
                class="btn icon"
                type="button"
                aria-label={t('friends.remove', { name: f.name })}
                title={t('friends.remove', { name: f.name })}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  apply(await removeFriend(f.key), { key: 'friends.removed', name: f.name });
                  setBusy(false);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p class="status" role="status">
          {t(message.key, { name: message.name ?? '' })}
        </p>
      )}
    </section>
  );
}
