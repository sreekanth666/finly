import { normaliseReason, senderKeyOf, summariseDetections, type DetectionFact } from '@/domain/support/diagnostics';
import { buildSupportEmail, formatAgo, REPORT_FILE, type ReportInput } from '@/domain/support/report';

const NOW = new Date(2026, 8, 13, 12, 0).getTime();
const HOUR = 3_600_000;

const fact = (overrides: Partial<DetectionFact> = {}): DetectionFact => ({
  kind: 'transaction',
  direction: 'debit',
  confidence: 'high',
  status: 'pending',
  reasons: '["kind:transaction","amount:marked","date:exact"]',
  parserVersion: 2,
  dateConfidence: 'exact',
  source: 'notification',
  packageName: 'com.google.android.apps.messaging',
  sender: 'VM-HDFCBK',
  title: null,
  issuer: 'HDFC Bank',
  createdAt: NOW - 3 * 24 * HOUR,
  detectedAmount: 72000,
  detectedAt: NOW - 3 * 24 * HOUR,
  detectedItem: 'SENTINEL PAYEE',
  suggestedCategoryId: 'cat-sentinel',
  suggestedAccountId: 'acct-sentinel',
  expenseSource: null,
  expenseAmount: null,
  expenseAt: null,
  expenseItem: null,
  expenseCategoryId: null,
  expenseAccountId: null,
  ...overrides,
});

const FACTS: DetectionFact[] = [
  fact(),
  fact({
    status: 'confirmed',
    expenseSource: 'detected',
    expenseAmount: 72000,
    expenseAt: NOW - 3 * 24 * HOUR,
    expenseItem: 'SENTINEL PAYEE',
    expenseCategoryId: 'cat-sentinel',
    expenseAccountId: 'acct-sentinel',
  }),
  fact({
    status: 'confirmed',
    expenseSource: 'detected',
    expenseAmount: 99999,
    expenseAt: NOW - 3 * 24 * HOUR,
    expenseItem: 'Sentinel lunch with Mom',
    expenseCategoryId: 'cat-sentinel-health',
    expenseAccountId: 'acct-sentinel',
  }),
  fact({ status: 'confirmed', expenseSource: 'manual', expenseAmount: 72000, expenseItem: 'Typed sentinel' }),
  fact({ kind: 'transfer', status: 'confirmed', expenseSource: 'detected', expenseAmount: 72000, expenseItem: 'SENTINEL PAYEE' }),
  fact({
    kind: 'unknown',
    confidence: 'low',
    status: 'not_transaction',
    reasons: '["kind:unknown","amount:none","counterparty:none","template:abc-123"]',
    sender: null,
    title: 'Mom',
    issuer: null,
    dateConfidence: 'fallback_received',
    parserVersion: 1,
  }),
  fact({ status: 'pending', parserVersion: 1, reasons: '["template:mute:xyz-9"]' }),
];

const input = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  topic: 'detection',
  userText: 'My HDFC alerts stopped showing up.',
  sections: { appDevice: true, detection: true, shapes: true },
  app: { version: '1.0.1', build: 'release', parserVersion: 2 },
  device: {
    os: 'Android',
    osVersion: '14',
    apiLevel: 34,
    manufacturer: 'Xiaomi',
    brand: 'Redmi',
    model: '23049PCD8I',
    locale: 'en-IN',
    timeZone: 'Asia/Kolkata',
    utcOffsetMinutes: 330,
    currency: 'INR',
    fontScale: 1,
  },
  status: {
    available: true,
    enabled: true,
    disclosureAccepted: true,
    granted: true,
    connected: false,
    notify: false,
    retentionDays: 30,
    defaultSmsPackage: 'com.example.sms',
    defaultSmsKnown: false,
    monitoredApps: ['PhonePe', 'com.example.bank'],
    counters: { queued: 0, rejected: 12, redacted: 2, unreadable: 1, errors: 0, lastCaptureAt: NOW - 5 * HOUR, lastConnectedAt: 0 },
    storedParserVersion: '2',
    templatesRev: 3,
    templatesDoneRev: '3',
    pendingBySection: { review: 2, maybe: 1, money_in: 0, filtered: 4 },
  },
  summary: summariseDetections(FACTS, { parserVersion: 2, now: NOW }),
  templates: [
    { senderKey: 'JANABK', packageName: null, issuer: null, outcome: 'transaction', direction: 'debit', overridesGate: null, timesMatched: 4, isEnabled: true },
  ],
  shapes: [{ sender: 'HDFCBK', kind: 'unknown', confidence: 'low', reasons: ['amount:none'], skeleton: 'Sent Rs.9.99 To AA A A' }],
  ...overrides,
});

describe('summariseDetections', () => {
  const summary = summariseDetections(FACTS, { parserVersion: 2, now: NOW });

  it('counts corrections as ground truth for misreads', () => {
    expect(summary.corrections).toEqual({
      confirmedAsRead: 1,
      amountChanged: 1,
      dayChanged: 0,
      itemChanged: 1,
      categoryChanged: 2,
      accountChanged: 1,
      linkedToTyped: 1,
      rescuedFromFiltered: 1,
      markedNotPayment: 1,
      duplicates: 0,
    });
  });

  it('keys senders by bank or app, never by a notification title', () => {
    const keys = summary.senders.map((row) => row.key);
    expect(keys).toContain('HDFCBK');
    expect(keys).toContain('SMS, no sender id');
    expect(keys).not.toContain('Mom');
  });

  it('normalises template ids out of the reasons', () => {
    expect(normaliseReason('template:abc-123')).toBe('template');
    expect(normaliseReason('template:mute:xyz')).toBe('template:mute');
    expect(summary.reasons.map(([reason]) => reason)).not.toContain('template:abc-123');
  });

  it('counts pending rows an older reader read, and how old the oldest row is', () => {
    expect(summary.readByOlderReader).toBe(1);
    expect(summary.oldestDays).toBe(3);
  });

  it('names a pasted message as pasted', () => {
    expect(senderKeyOf({ sender: null, title: null, issuer: null, packageName: null, source: 'paste' })).toBe('Pasted');
  });
});

describe('buildSupportEmail', () => {
  it('never carries a payee, an amount, an item, a contact name or an id from the device', () => {
    const email = buildSupportEmail(input(), NOW);
    const everything = `${email.subject}\n${email.body}\n${email.attachment?.text ?? ''}`;
    for (const secret of ['SENTINEL', 'Sentinel', 'Mom', '72000', '99999', '720.00', 'cat-sentinel', 'acct-sentinel', 'abc-123', 'xyz-9']) {
      expect([secret, everything.includes(secret)]).toEqual([secret, false]);
    }
  });

  it('puts a short summary in the body and everything else in the attachment', () => {
    const email = buildSupportEmail(input(), NOW);
    expect(email.subject).toBe('Finly 1.0.1: detection problem');
    expect(email.body).toContain('My HDFC alerts stopped showing up.');
    expect(email.body).toContain('Phone: Xiaomi Redmi 23049PCD8I');
    expect(email.body).toContain('listener not running, last alert read 5 h ago, hidden by Android 2');
    expect(email.attachment?.name).toBe(REPORT_FILE);
    expect(email.attachment?.text).toContain('(NOT in the known SMS apps)');
    expect(email.attachment?.text).toContain('HDFCBK: 6,');
    expect(email.attachment?.text).toContain('Sent Rs.9.99 To AA A A');
    const json = JSON.parse(email.attachment!.text.split('\n').at(-1)!);
    expect(json.v).toBe(1);
  });

  it('leaves out each section that is switched off', () => {
    const noShapes = buildSupportEmail(input({ sections: { appDevice: true, detection: true, shapes: false } }), NOW);
    expect(noShapes.attachment?.text).not.toContain('Message shapes');
    const noDevice = buildSupportEmail(input({ sections: { appDevice: false, detection: true, shapes: false } }), NOW);
    expect(`${noDevice.body}${noDevice.attachment?.text}`).not.toContain('Xiaomi');
  });

  it('sends only what was written when nothing else is chosen, with no attachment', () => {
    const email = buildSupportEmail(
      input({ topic: 'other', userText: 'Love the app.', sections: { appDevice: false, detection: false, shapes: false } }),
      NOW,
    );
    expect(email).toEqual({ subject: 'Finly 1.0.1: feedback', body: 'Love the app.', attachment: null });
  });
});

describe('formatAgo', () => {
  it('reads like a person would say it', () => {
    expect(formatAgo(0, NOW)).toBe('never');
    expect(formatAgo(NOW - 30_000, NOW)).toBe('just now');
    expect(formatAgo(NOW - 20 * 60_000, NOW)).toBe('20 min ago');
    expect(formatAgo(NOW - 5 * HOUR, NOW)).toBe('5 h ago');
    expect(formatAgo(NOW - 72 * HOUR, NOW)).toBe('3 d ago');
  });
});
