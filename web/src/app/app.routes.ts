import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'repositories' },
  {
    path: 'repositories',
    title: 'Repositories · ReleaseWatcher',
    loadComponent: () => import('./pages/repositories/repositories.page').then((m) => m.RepositoriesPage),
  },
  {
    path: 'settings',
    title: 'Settings · ReleaseWatcher',
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'repositories' },
];
