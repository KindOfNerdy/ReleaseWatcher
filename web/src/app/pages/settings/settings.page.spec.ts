import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppSettings } from '../../core/models';
import { settle } from '../../testing';
import { SettingsPage } from './settings.page';

const settings: AppSettings = {
  discord: { webhookConfigured: false, webhookUrlMasked: null, webhookSource: null, mention: null, username: 'ReleaseWatcher' },
  github: { tokenConfigured: false, tokenMasked: null, tokenSource: null },
  polling: { intervalMinutes: 15, intervalSource: 'env', minIntervalMinutes: 1, maxIntervalMinutes: 1440 },
};

describe('SettingsPage', () => {
  it('saves the Discord webhook and shows field errors', async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();

    http.expectOne('/api/settings').flush(settings);
    await settle(fixture);
    http.expectOne('/api/github/rate-limit').flush({ limit: 60, remaining: 42, resetAt: '2026-01-01T00:00:00Z' });
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Not configured');
    expect(el.querySelector('.quota-meta')?.textContent).toContain('42');

    const input = el.querySelector<HTMLInputElement>('#webhook')!;
    input.value = 'not-a-url';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('section form button[type=submit]')!.click();

    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.discordWebhookUrl).toBe('not-a-url');
    request.flush(
      { status: 400, errors: { discordWebhookUrl: ['Webhook URL must be a valid URL.'] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(el.querySelector('.error')?.textContent).toContain('valid URL');
  });
});
