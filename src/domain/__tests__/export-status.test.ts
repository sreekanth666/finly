import { decideExport } from '@/domain/export-status';

const shared = { uri: 'file:///cache/finly.json', shared: true };
const unavailable = { uri: 'file:///cache/finly.json', shared: false };

describe('decideExport', () => {
  it('only the full backup (json) moves the last-backed-up stamp', () => {
    // The core of the bug: a CSV export used to stamp "Backed up" even though
    // it cannot restore accounts, rules, settlements or categories.
    expect(decideExport('json', shared).recordTimestamp).toBe(true);
    expect(decideExport('csv', shared).recordTimestamp).toBe(false);
  });

  it('a CSV is ready-to-share wording, and never claims it completed', () => {
    // The share sheet resolves the moment it closes, so "Expenses exported"
    // was a lie when the user tapped away. The line now says ready to share.
    const csv = decideExport('csv', shared);
    expect(csv.notice).toBe('Expenses ready to share.');
    expect(csv.notice).not.toContain('exported');
  });

  it('a cancelled / dismissed share (sheet available) does not count as a backup for csv', () => {
    // expo-sharing resolves shareAsync the instant the sheet closes, whether
    // the user shared or just tapped away. A cancelled CSV must not move the
    // stamp: it only does so for a full backup that was actually handed out.
    expect(decideExport('csv', shared).recordTimestamp).toBe(false);
  });

  it('when no share app is available nothing left the device, so no stamp', () => {
    // The file is written to the cache and handed nowhere. That is not a
    // backup, for either kind.
    expect(decideExport('json', unavailable).recordTimestamp).toBe(false);
    expect(decideExport('csv', unavailable).recordTimestamp).toBe(false);
    expect(decideExport('json', unavailable).notice).toContain(unavailable.uri);
  });

  it('names the thing that did not leave the device when sharing is unavailable', () => {
    const csv = decideExport('csv', unavailable);
    expect(csv.notice).toContain('Expenses saved to');
    const json = decideExport('json', unavailable);
    expect(json.notice).toContain('Backup saved to');
  });

  it('json share says ready to share and does not claim a specific app', () => {
    const json = decideExport('json', shared);
    expect(json.recordTimestamp).toBe(true);
    expect(json.notice).toBe('Backup ready to share.');
  });
});
