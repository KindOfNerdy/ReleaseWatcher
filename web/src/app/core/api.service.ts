import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AddRepositoryRequest,
  AppSettings,
  AppStatus,
  CheckResult,
  HeaderInput,
  InstalledVersionTestResult,
  Notifier,
  RateLimit,
  SettingsPatch,
  TestNotificationResult,
  UpdateRepositoryRequest,
  WatchedRepository,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getRepositories(): Observable<WatchedRepository[]> {
    return this.http.get<WatchedRepository[]>(`${this.baseUrl}/repositories`);
  }

  addRepository(request: AddRepositoryRequest): Observable<WatchedRepository> {
    return this.http.post<WatchedRepository>(`${this.baseUrl}/repositories`, request);
  }

  updateRepository(id: number, request: UpdateRepositoryRequest): Observable<WatchedRepository> {
    return this.http.put<WatchedRepository>(`${this.baseUrl}/repositories/${id}`, request);
  }

  deleteRepository(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/repositories/${id}`);
  }

  checkNow(id: number): Observable<CheckResult> {
    return this.http.post<CheckResult>(`${this.baseUrl}/repositories/${id}/check`, {});
  }

  checkAll(): Observable<AppStatus> {
    return this.http.post<AppStatus>(`${this.baseUrl}/check-all`, {});
  }

  getStatus(): Observable<AppStatus> {
    return this.http.get<AppStatus>(`${this.baseUrl}/status`);
  }

  getNotifiers(): Observable<Notifier[]> {
    return this.http.get<Notifier[]>(`${this.baseUrl}/notifiers`);
  }

  sendTestNotification(): Observable<TestNotificationResult> {
    return this.http.post<TestNotificationResult>(`${this.baseUrl}/notifiers/test`, {});
  }

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(patch: SettingsPatch): Observable<AppSettings> {
    return this.http.put<AppSettings>(`${this.baseUrl}/settings`, patch);
  }

  testInstalledVersion(
    url: string,
    field: string | null,
    headers: HeaderInput[],
    repositoryId: number | null,
  ): Observable<InstalledVersionTestResult> {
    return this.http.post<InstalledVersionTestResult>(`${this.baseUrl}/installed-version/test`, {
      url,
      field,
      headers,
      repositoryId,
    });
  }

  getRateLimit(): Observable<RateLimit | null> {
    return this.http.get<RateLimit | null>(`${this.baseUrl}/github/rate-limit`);
  }
}

/** Extracts a human readable message from a problem-details response. */
export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as { title?: string; detail?: string; errors?: Record<string, string[]> } | null;
    const validation = problem?.errors ? Object.values(problem.errors).flat().join(' ') : null;
    return validation || problem?.detail || problem?.title || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
