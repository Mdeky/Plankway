import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  ensureProfile,
  fetchMe,
  fetchProviders,
  loadProfileInfo,
  newRecoveryCode,
  signInUrl,
  type Account,
} from '../game/api.ts';
import { deleteAllData, recoverWithCode, signOutDevice } from '../game/sync.ts';
import { getThemePref, setThemePref, type ThemePref } from '../game/theme.ts';
import { getLang, t, type MessageKey } from '../i18n.ts';
import { navigate, type Route } from '../route.ts';
import { AccountForm } from './AccountForm.tsx';
import { Dialog } from './Dialog.tsx';
import { FriendsSection } from './FriendsSection.tsx';
import { Icon, type IconName } from './icons.tsx';

type View = 'menu' | 'account' | 'friends' | 'transfer' | 'delete' | 'signout';

interface State {
  loaded: boolean;
  /** Null for guests (anonymous profile, or none yet). */
  account: Account | null;
  providers: string[];
}

/**
 * The profile: who you are at a glance, then a short menu. Every form lives in its own
 * sub-view, so the first screen stays calm.
 */
export function ProfileDialog({
  onClose,
  onDataChanged,
  notice,
}: {
  onClose(): void;
  onDataChanged(): void;
  /** E.g. right after signing in, or when opened through a friend invite. */
  notice?: MessageKey | null;
}) {
  const [state, setState] = useState<State>({ loaded: false, account: null, providers: [] });
  const [view, setView] = useState<View>('menu');
  const [back, setBack] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);

  const load = async () => {
    const [me, providers] = await Promise.all([fetchMe(), fetchProviders()]);
    const account = me?.account ?? null;
    setState({ loaded: true, account, providers });
    return account;
  };

  useEffect(() => {
    void load().then((account) => {
      // Take the player straight to what the notice is about.
      if (notice === 'account.welcome' && account) setView('account');
      else if (notice === 'friends.invited' && account?.displayName) setView('friends');
      else if (notice) setMessage(notice);
    });
  }, []);

  const open = (next: View) => {
    setBack(false);
    setMessage(null);
    setView(next);
  };
  const toMenu = (msg: MessageKey | null = null) => {
    setBack(true);
    setMessage(msg);
    setView('menu');
  };
  const go = (route: Route) => {
    onClose();
    navigate(route);
  };

  const { account } = state;
  const titles: Record<Exclude<View, 'menu'>, MessageKey> = {
    account: 'profile.menu.account',
    friends: 'profile.menu.friends',
    transfer: 'profile.menu.transfer',
    delete: 'profile.menu.delete',
    signout: 'profile.menu.signOut',
  };

  return (
    <Dialog title={t('profile.title')} hideTitle onClose={onClose} class="profile-dialog">
      {view === 'menu' ? (
        <div class={`profile-view${back ? ' back' : ''}`} key="menu">
          <ProfileHeader account={account} loaded={state.loaded} />

          {message && (
            <p class="profile-note" role="status">
              {t(message)}
            </p>
          )}

          {state.loaded && !account && state.providers.length > 0 && (
            <Callout title={t('profile.hero.title')} text={t('profile.hero.text')}>
              {state.providers.map((p) => (
                <a key={p} class="btn callout-btn" href={signInUrl(p)}>
                  <Icon name="login" />
                  {t('account.google')}
                </a>
              ))}
            </Callout>
          )}
          {account && !account.displayName && (
            <Callout title={t('profile.name.title')} text={t('profile.name.text')}>
              <button class="btn callout-btn" onClick={() => open('account')}>
                {t('profile.name.button')}
              </button>
            </Callout>
          )}

          <ThemeSwitch />

          <nav class="profile-menu" aria-label={t('profile.title')}>
            {account && (
              <MenuRow icon="user" label={t('profile.menu.account')} detail={account.displayName ?? undefined} onClick={() => open('account')} />
            )}
            {account?.displayName && <MenuRow icon="users" label={t('profile.menu.friends')} onClick={() => open('friends')} />}
            <MenuRow icon="trophy" label={t('board.title')} onClick={() => go('leaderboard')} />
            {state.loaded && !account && <MenuRow icon="transfer" label={t('profile.menu.transfer')} onClick={() => open('transfer')} />}
            <MenuRow icon="trash" label={t('profile.menu.delete')} onClick={() => open('delete')} />
            {account && <MenuRow icon="logout" label={t('profile.menu.signOut')} danger onClick={() => open('signout')} />}
          </nav>

          <footer class="profile-footer">
            <span>Plankway</span>
            <span>
              <a href="/privacy" onClick={(e) => (e.preventDefault(), go('privacy'))}>
                {t('footer.privacy')}
              </a>
              {' · '}
              <a href="/terms" onClick={(e) => (e.preventDefault(), go('terms'))}>
                {t('footer.terms')}
              </a>
            </span>
          </footer>
          <div class="dialog-actions">
            <button class="btn" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </div>
      ) : (
        <div class="profile-view" key={view}>
          <header class="profile-subheader">
            <button class="btn icon" onClick={() => toMenu()} aria-label={t('common.back')}>
              <Icon name="back" />
            </button>
            <h3>{t(titles[view])}</h3>
          </header>

          {view === 'account' && account && (
            <AccountForm
              account={account}
              notice={notice === 'account.welcome' ? notice : null}
              onSaved={(next) => setState((s) => ({ ...s, account: next }))}
            />
          )}
          {view === 'friends' && <FriendsSection />}
          {view === 'transfer' && <TransferView onDataChanged={onDataChanged} />}
          {view === 'delete' && (
            <DeleteView
              onDone={() => {
                onDataChanged();
                void load();
                toMenu('profile.deleted');
              }}
            />
          )}
          {view === 'signout' && (
            <SignOutView
              onDone={() => {
                onDataChanged();
                void load();
                toMenu('account.signedOut');
              }}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

function ProfileHeader({ account, loaded }: { account: Account | null; loaded: boolean }) {
  const name = account?.displayName;
  const country = useMemo(() => {
    if (!account?.country) return null;
    try {
      return new Intl.DisplayNames([getLang()], { type: 'region' }).of(account.country) ?? account.country;
    } catch {
      return account.country;
    }
  }, [account?.country]);

  return (
    <div class="profile-header">
      <div class="profile-avatar" aria-hidden="true">
        {name ? [...name][0]!.toUpperCase() : <Icon name="user" />}
      </div>
      <div class="profile-who">
        <p class="profile-name">
          {name ?? (account ? t('profile.noName') : t('profile.guest'))}
          {account && (
            <span class="profile-check" title={t('profile.signedIn')}>
              <Icon name="check" />
            </span>
          )}
        </p>
        <p class="profile-sub">
          {!loaded ? ' ' : account ? [country, t('profile.signedIn')].filter(Boolean).join(' · ') : t('profile.guestSub')}
        </p>
      </div>
    </div>
  );
}

function Callout({ title, text, children }: { title: string; text: string; children: ComponentChildren }) {
  return (
    <div class="profile-callout">
      <p class="callout-title">{title}</p>
      <p class="callout-text">{text}</p>
      {children}
    </div>
  );
}

function ThemeSwitch() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const options: [ThemePref, IconName, MessageKey][] = [
    ['system', 'auto', 'profile.theme.auto'],
    ['light', 'sun', 'profile.theme.light'],
    ['dark', 'moon', 'profile.theme.dark'],
  ];
  return (
    <div class="segmented theme-switch" role="group" aria-label={t('settings.theme')}>
      {options.map(([value, icon, label]) => (
        <button
          key={value}
          class={pref === value ? 'active' : ''}
          aria-pressed={pref === value}
          onClick={() => {
            setPref(value);
            setThemePref(value);
          }}
        >
          <Icon name={icon} />
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function MenuRow({ icon, label, detail, danger, onClick }: { icon: IconName; label: string; detail?: string; danger?: boolean; onClick(): void }) {
  return (
    <button class={`menu-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <Icon name={icon} />
      <span class="menu-label">{label}</span>
      {detail && <span class="menu-detail">{detail}</span>}
      {!danger && <Icon name="chevron" class="menu-chevron" />}
    </button>
  );
}

/** Recovery code: continue this (anonymous) profile on another device. */
function TransferView({ onDataChanged }: { onDataChanged(): void }) {
  const [profile, setProfile] = useState(loadProfileInfo);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    await task();
    setBusy(false);
  };

  return (
    <>
      <p class="muted">{t('profile.transfer.intro')}</p>
      <section class="profile-section">
        <h4>{t('profile.codeTitle')}</h4>
        {profile?.recoveryCode ? (
          <>
            <p class="recovery-code" translate={false}>
              {profile.recoveryCode}
            </p>
            <p class="muted">{t('profile.codeHelp')}</p>
          </>
        ) : profile ? (
          <>
            <p class="muted">{t('profile.codeUnknown')}</p>
            <button
              class="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const info = await newRecoveryCode();
                  if (info) setProfile(info);
                  else setMessage('profile.error.offline');
                })
              }
            >
              {t('profile.newCode')}
            </button>
          </>
        ) : (
          <button
            class="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const info = await ensureProfile();
                setProfile(info);
                if (!info) setMessage('profile.offline');
              })
            }
          >
            {t('profile.connect')}
          </button>
        )}
      </section>

      <form
        class="profile-section"
        onSubmit={(ev) => {
          ev.preventDefault();
          void run(async () => {
            const outcome = await recoverWithCode(code);
            if (outcome.ok) {
              setProfile(loadProfileInfo());
              setCode('');
              setMessage('profile.recovered');
              onDataChanged();
            } else {
              setMessage(`profile.error.${outcome.error}`);
            }
          });
        }}
      >
        <h4>{t('profile.recoverTitle')}</h4>
        <label class="field">
          <span>{t('profile.recoverLabel')}</span>
          <input
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            placeholder="lumo-taki-ravo-nesi"
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
          />
        </label>
        <button class="btn" type="submit" disabled={busy || code.trim().length < 8}>
          {t('profile.recoverButton')}
        </button>
      </form>
      {message && (
        <p class="status" role="status">
          {t(message)}
        </p>
      )}
    </>
  );
}

function DeleteView({ onDone }: { onDone(): void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  return (
    <>
      <p>{t('profile.deleteConfirm')}</p>
      <button
        class="btn danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { server } = await deleteAllData();
          setBusy(false);
          if (server) onDone();
          else setMessage('profile.deleteOffline');
        }}
      >
        {t('profile.deleteButton')}
      </button>
      {message && (
        <p class="status" role="status">
          {t(message)}
        </p>
      )}
    </>
  );
}

function SignOutView({ onDone }: { onDone(): void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  return (
    <>
      <p>{t('account.signOutHelp')}</p>
      <button
        class="btn danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await signOutDevice();
          setBusy(false);
          if (ok) onDone();
          else setMessage('account.error.offline');
        }}
      >
        {t('account.signOut')}
      </button>
      {message && (
        <p class="status" role="status">
          {t(message)}
        </p>
      )}
    </>
  );
}
