// Admin Panel password gate (client-side UX gate; auth ainda exigida via RLS).
export const ADMIN_PANEL_PASSWORD = 'Lemon1235@';
export const ADMIN_PANEL_SESSION_KEY = 'admin_panel_unlocked';

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_PANEL_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function unlockAdmin(): void {
  sessionStorage.setItem(ADMIN_PANEL_SESSION_KEY, 'true');
}

export function lockAdmin(): void {
  sessionStorage.removeItem(ADMIN_PANEL_SESSION_KEY);
}
