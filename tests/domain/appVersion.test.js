import { describe, expect, it } from 'vitest';
import { appUpdateMessage, isRemoteVersionNewer } from '../../domain/appVersion.js';

describe('appVersion domain', () => {
  it('detects when the server build is ahead of this client', () => {
    expect(isRemoteVersionNewer(5, 6)).toBe(true);
    expect(isRemoteVersionNewer(6, 6)).toBe(false);
    expect(isRemoteVersionNewer(7, 6)).toBe(false);
  });

  it('uses the reinstall message requested for staff', () => {
    expect(appUpdateMessage()).toBe('Hay una versión nueva, borra esta versión y agrega la nueva');
  });
});
