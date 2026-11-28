import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeAssistantOverview } from '../../core/models';
import { settle } from '../../testing';
import { haComponent, haConnection, haOverview } from './fixtures';
import { HomeAssistantPage, repositoryLink } from './home-assistant.page';

describe('HomeAssistantPage', () => {
  let http: HttpTestingController;

  const create = async (overview: HomeAssistantOverview) => {
    await TestBed.configureTestingModule({
      imports: [HomeAssistantPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HomeAssistantPage);
    fixture.detectChanges();
    http.expectOne('/api/home-assistant').flush(overview);
    await settle(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  const rows = (el: HTMLElement) => [...el.querySelectorAll('.row')];

  afterEach(() => http.verify());

  it('shows the connection with its components, their repositories and versions', async () => {
    const { el } = await create(haOverview());
    const card = el.querySelector('section.source')!;
    expect(card.querySelector('h2')?.textContent?.trim()).toBe('Home');
    expect(card.textContent).toContain('http://homeassistant.local:8123');
    const [card1, core, commit] = rows(el);
    expect(card1!.textContent).toContain('Button Card');
    expect(card1!.textContent).toContain('v7.0.0');
    expect(card1!.textContent).toContain('v7.0.1');
    expect(card1!.textContent).toContain('Update available');
    expect(card1!.querySelector<HTMLAnchorElement>('a.repository')!.href).toBe('https://github.com/custom-cards/button-card');
    expect(core!.textContent).toContain('home-assistant/core');
    expect(core!.textContent).toContain('Up to date');
    // A commit hash is shown, and marked as not comparable with releases.
    expect(commit!.textContent).toContain('a358575');
    expect(commit!.textContent).toContain('Commit');
  });

  it('shows an add-on that names no repository without a link or a watch button', async () => {
    const addon = haComponent({
      id: 4,
      entityId: 'update.music_assistant_update',
      name: 'Music Assistant',
      releaseUrl: null,
      repositoryName: '',
      suggestedRepository: null,
      homeAssistantUpdate: false,
    });
    const { el } = await create(haOverview({ components: [addon] }));
    const [row] = rows(el);
    expect(row!.textContent).toContain('no repository');
    expect(row!.querySelector('a.repository')).toBeNull();
    expect(row!.textContent).not.toContain('Watch');
  });

  it('says when Home Assistant waits for a restart', async () => {
    const { el } = await create(haOverview({ connections: [haConnection({ pendingRestarts: ['Battery Notes'] })] }));
    const badge = [...el.querySelectorAll('.source-actions .badge')].find((b) => b.textContent?.includes('Restart needed'));
    expect(badge?.getAttribute('title')).toContain('Battery Notes');
  });

  it('links repositories outside GitHub to their host', () => {
    expect(repositoryLink('owner/repo')).toBe('https://github.com/owner/repo');
    expect(repositoryLink('codeberg.org/owner/repo')).toBe('https://codeberg.org/owner/repo');
  });

  it('filters by updates', async () => {
    const { fixture, el } = await create(haOverview());
    const tab = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.tab')].find((t) => t.textContent?.includes(label))!;
    expect(tab('All').textContent).toContain('3');
    expect(tab('Updates').textContent).toContain('1');
    tab('Updates').click();
    await settle(fixture);
    expect(rows(el).map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Button Card']);
  });

  it('shows an empty state that points to the settings', async () => {
    const { el } = await create(haOverview({ connections: [], components: [] }));
    expect(el.querySelector('.empty h2')?.textContent).toContain('No Home Assistant yet');
    expect(el.textContent).toContain('long-lived access token');
  });

  it('shows the error of a connection and keeps what was read before', async () => {
    const { el } = await create(haOverview({ connections: [haConnection({ lastError: 'Home Assistant rejected the access token.' })] }));
    expect(el.querySelector('.error-line')?.textContent).toContain('rejected the access token');
    expect(rows(el).length).toBe(3);
  });

  it('checks a connection and reloads until it finished', async () => {
    const { fixture, el } = await create(haOverview());
    el.querySelector<HTMLButtonElement>('button[aria-label="Check Home"]')!.click();
    http.expectOne({ method: 'POST', url: '/api/home-assistant/connections/1/check' }).flush(haConnection({ isChecking: true }));
    await settle(fixture);
    expect(el.querySelector('.source-actions')?.textContent).toContain('Checking…');
    fixture.destroy();
  });
  it('keeps reloading while a check takes longer than one round', async () => {
    const round = () => new Promise((resolve) => setTimeout(resolve, 2100));
    const { fixture, el } = await create(haOverview({ connections: [haConnection({ isChecking: true })] }));
    // Still checking after the first round …
    await round();
    http.expectOne('/api/home-assistant').flush(haOverview({ connections: [haConnection({ isChecking: true })] }));
    await settle(fixture);
    // … so it asks again, and shows the result once it is done.
    await round();
    http.expectOne('/api/home-assistant').flush(haOverview());
    await settle(fixture);
    expect(el.querySelector('.source-actions')?.textContent).not.toContain('Checking…');
  }, 10_000);
  it('shows a watched repository, compares with its releases and offers the others to watch', async () => {
    const watched = haComponent({
      repository: { id: 7, fullName: 'custom-cards/button-card', url: 'https://github.com/custom-cards/button-card', latestVersion: 'v7.1.0', iconUrls: [] },
      suggestedRepository: null,
      updateAvailable: true,
      homeAssistantUpdate: false,
    });
    const { fixture, el } = await create(haOverview({ components: [watched, ...haOverview().components.slice(1)] }));
    const [card, core] = rows(el);
    // The repository's release, not the version Home Assistant knows.
    expect(card!.textContent).toContain('v7.1.0');
    // Watched already; nothing to install yet, and installing is switched off – so no button.
    expect(card!.querySelector('button')).toBeNull();
    expect(core!.querySelector('button')?.textContent).toContain('Watch');

    const tab = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.tab')].find((t) => t.textContent?.includes(label))!;
    expect(tab('Not watched').textContent).toContain('2');
    tab('Not watched').click();
    await settle(fixture);
    expect(rows(el).map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Home Assistant Core', 'Some integration']);

    rows(el)[0]!.querySelector<HTMLButtonElement>('button')!.click();
    const add = http.expectOne({ method: 'POST', url: '/api/repositories' });
    expect(add.request.body).toEqual({ repository: 'home-assistant/core', includePrereleases: false });
    add.flush({ id: 8 });
    await settle(fixture);
    http.expectOne('/api/home-assistant').flush(haOverview());
    await settle(fixture);
  });

  it('searches component and repository names', async () => {
    const { fixture, el } = await create(haOverview());
    const input = el.querySelector<HTMLInputElement>('#home-assistant-search')!;
    input.value = 'core';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(rows(el).map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Home Assistant Core']);
    input.value = 'nothing-like-this';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(el.querySelector('.empty')?.textContent).toContain('No component matches the search.');
  });

  it('installs an update after a confirmation, with a backup where Home Assistant offers one', async () => {
    const installable = haComponent({ installBlocker: null, supportsBackup: true });
    const { fixture, el } = await create(haOverview({ components: [installable, ...haOverview().components.slice(1)] }));
    const row = () => rows(el)[0]!;
    const button = (text: string) => [...row().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(text))!;
    // The other rows have no update to install, or installing is switched off.
    expect(rows(el)[1]!.textContent).not.toContain('Install');
    button('Install').click();
    await settle(fixture);
    expect(row().textContent).toContain('Install v7.0.1 in Home Assistant?');
    expect(row().querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
    button('Yes').click();
    const post = http.expectOne({ method: 'POST', url: '/api/home-assistant/components/1/install' });
    expect(post.request.body).toEqual({ backup: true });
    post.flush({ ...installable, isInstalling: true });
    await settle(fixture);
    expect(row().textContent).toContain('Installing v7.0.1…');
    fixture.destroy();
  });

  it('installs the chosen updates one after another and offers the restart afterwards', async () => {
    const connection = haConnection({ installEnabled: true });
    const card = haComponent({ installBlocker: null, supportsBackup: false });
    const addon = haComponent({ id: 4, entityId: 'update.addon_update', name: 'Add-on', repositoryName: 'owner/addon', installBlocker: null, supportsBackup: true });
    const os = haComponent({ id: 5, entityId: 'update.home_assistant_operating_system_update', name: 'Operating System', repositoryName: 'home-assistant/operating-system', installBlocker: null });
    const { fixture, el } = await create(haOverview({ connections: [connection], components: [addon, card, os] }));
    const header = () => el.querySelector('.header-actions')!;
    const headerButton = (text: string) => [...header().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(text))!;

    headerButton('Update').click();
    await settle(fixture);
    // Every installable update is ticked – not the operating system, which is installed on its own.
    const picks = () => [...el.querySelectorAll<HTMLInputElement>('input.pick')];
    expect(picks().map((p) => p.getAttribute('aria-label'))).toEqual(['Update Add-on', 'Update Button Card']);
    expect(header().textContent).toContain('2 of 2 update(s) selected');
    picks()[1]!.click();
    await settle(fixture);
    expect(header().textContent).toContain('1 of 2 update(s) selected');

    headerButton('Update 1').click();
    const post = http.expectOne({ method: 'POST', url: '/api/home-assistant/connections/1/update' });
    expect(post.request.body).toEqual({ ids: [4], backup: true });
    post.flush({ ...connection, isChecking: true });
    await settle(fixture);
    http.expectOne('/api/home-assistant').flush(
      haOverview({ connections: [{ ...connection, isChecking: true }], components: [{ ...addon, isInstalling: true }, card, os] }),
    );
    await settle(fixture);
    expect(el.querySelector('.source-actions')!.textContent).toContain('Installing Add-on…');

    // Done: the integration waits for a restart, which is offered once.
    fixture.componentInstance['load']();
    http.expectOne('/api/home-assistant').flush(
      haOverview({ connections: [{ ...connection, pendingRestarts: ['Add-on'] }], components: [{ ...addon, installBlocker: 'Home Assistant has no update for this component.', homeAssistantUpdate: false }, card, os] }),
    );
    await settle(fixture);
    expect(el.querySelector('.source-actions')!.textContent).toContain('Restart Home Assistant?');
    fixture.destroy();
  });

  it('shows why the last installation failed', async () => {
    const failed = haComponent({ installBlocker: null, installError: 'Home Assistant answered 500: Update failed.' });
    const { el } = await create(haOverview({ components: [failed] }));
    expect(rows(el)[0]!.querySelector('.install-error')?.textContent).toContain('answered 500');
  });

  it('restarts Home Assistant after a confirmation when installing is switched on', async () => {
    const { fixture, el } = await create(haOverview({ connections: [haConnection({ installEnabled: true })] }));
    el.querySelector<HTMLButtonElement>('button[aria-label="Restart Home"]')!.click();
    await settle(fixture);
    const actions = el.querySelector('.source-actions')!;
    expect(actions.textContent).toContain('Restart Home Assistant?');
    [...actions.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Yes')!.click();
    http.expectOne({ method: 'POST', url: '/api/home-assistant/connections/1/restart' }).flush(haConnection({ installEnabled: true, isRestarting: true }));
    await settle(fixture);
    expect(el.querySelector('.source-actions')?.textContent).toContain('Home Assistant is restarting…');
    fixture.destroy();
  });

  it('offers no restart while installing is switched off', async () => {
    const { el } = await create(haOverview());
    expect(el.querySelector('button[aria-label="Restart Home"]')).toBeNull();
  });

  it('asks Home Assistant to look for a release it has not reported yet', async () => {
    const behind = haComponent({
      repository: { id: 7, fullName: 'custom-cards/button-card', url: 'https://github.com/custom-cards/button-card', latestVersion: 'v7.2.0', iconUrls: [] },
      suggestedRepository: null,
      updateAvailable: true,
      homeAssistantUpdate: false,
      installBlocker: null,
    });
    const { fixture, el } = await create(haOverview({ connections: [haConnection({ installEnabled: true })], components: [behind] }));
    const button = [...rows(el)[0]!.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Check in Home Assistant'))!;
    expect(rows(el)[0]!.textContent).not.toContain('Install');
    button.click();
    http.expectOne({ method: 'POST', url: '/api/home-assistant/components/1/refresh' }).flush({ ...behind, homeAssistantUpdate: true, latestVersion: 'v7.2.0' });
    await settle(fixture);
    expect([...rows(el)[0]!.querySelectorAll('button')].some((b) => b.textContent?.includes('Install'))).toBe(true);
  });

});
