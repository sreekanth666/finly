/**
 * The email a user sends the developer (D19): what they wrote, a short
 * summary in the body, and everything else in an attached text file.
 *
 * Everything here is assembled from counts, flags and names of banks and apps
 * — see `diagnostics.ts` for how values become counts, and `skeleton.ts` for
 * how a message becomes its shape. Each section can be switched off, and the
 * user sees all of it before their mail app opens.
 *
 * Deliberately absent, whatever is switched on: any message text, raw or
 * masked; amounts, balances, references and card digits; payees, expense
 * items, notes, categories, accounts, rules and budget; the profile name;
 * template names and samples; any timestamp of a single payment; any device
 * or install identifier.
 */

import type { DetectionSummary } from './diagnostics';

export type ReportTopic = 'detection' | 'other';

export type ReportSections = {
  /** App version, reader version, Android version, phone make and model, locale. */
  appDevice: boolean;
  /** Detection settings, listener health, counts, per-sender table, templates. */
  detection: boolean;
  /** Skeletons of messages Finly had trouble with. Off unless chosen. */
  shapes: boolean;
};

export type AppInfo = { version: string | null; build: 'development' | 'release'; parserVersion: number };

export type DeviceInfo = {
  os: string;
  osVersion: string | null;
  apiLevel: number | null;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  locale: string | null;
  timeZone: string | null;
  utcOffsetMinutes: number;
  currency: string;
  fontScale: number;
};

export type ListenerCounters = {
  queued: number;
  rejected: number;
  redacted: number;
  unreadable: number;
  errors: number;
  lastCaptureAt: number;
  lastConnectedAt: number;
};

export type DetectionStatus = {
  available: boolean;
  enabled: boolean;
  disclosureAccepted: boolean;
  granted: boolean;
  connected: boolean;
  notify: boolean;
  retentionDays: number;
  defaultSmsPackage: string | null;
  /** Whether the default SMS app is one the app's own list knows. */
  defaultSmsKnown: boolean | null;
  monitoredApps: string[];
  counters: ListenerCounters | null;
  storedParserVersion: string | null;
  templatesRev: number;
  templatesDoneRev: string | null;
  pendingBySection: Record<string, number>;
};

export type TemplateFact = {
  senderKey: string | null;
  packageName: string | null;
  issuer: string | null;
  outcome: string;
  direction: string | null;
  overridesGate: string | null;
  timesMatched: number;
  isEnabled: boolean;
};

export type MessageShape = { sender: string; kind: string; confidence: string; reasons: string[]; skeleton: string };

export type ReportInput = {
  topic: ReportTopic;
  userText: string;
  sections: ReportSections;
  app: AppInfo;
  device: DeviceInfo;
  status: DetectionStatus | null;
  summary: DetectionSummary | null;
  templates: readonly TemplateFact[];
  shapes: readonly MessageShape[];
};

export type SupportEmail = {
  subject: string;
  body: string;
  attachment: { name: string; text: string } | null;
};

export const REPORT_FILE = 'finly-report.txt';

/** "just now", "12 min ago", "3 h ago", "2 d ago", or "never". */
export function formatAgo(at: number, now: number): string {
  if (at <= 0) return 'never';
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const yes = (value: boolean) => (value ? 'yes' : 'no');

const counts = (record: Record<string, number>) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key} ${value}`)
    .join(', ') || 'none';

function appDeviceLines(app: AppInfo, device: DeviceInfo): string[] {
  const offset = device.utcOffsetMinutes;
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const phone = [device.manufacturer, device.brand !== device.manufacturer ? device.brand : null, device.model]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' ');
  return [
    `App: Finly ${app.version ?? 'unknown'} (${app.build}), reader ${app.parserVersion}`,
    `System: ${device.os} ${device.osVersion ?? ''}${device.apiLevel === null ? '' : ` (API ${device.apiLevel})`}`.trim(),
    `Phone: ${phone.length > 0 ? phone : 'unknown'}`,
    `Locale: ${device.locale ?? 'unknown'}, time zone ${device.timeZone ?? 'unknown'} (UTC${sign}${hours}:${minutes}), app currency ${device.currency}, font scale ${device.fontScale}`,
  ];
}

function statusLines(status: DetectionStatus, now: number): string[] {
  const lines = [
    `Detection available on this phone: ${yes(status.available)}`,
    `Switched on: ${yes(status.enabled)}, disclosure agreed: ${yes(status.disclosureAccepted)}`,
    `Notification access: ${status.granted ? 'allowed' : 'not allowed'}, listener: ${status.connected ? 'running' : 'not running'}`,
    `Count notification while closed: ${yes(status.notify)}, keep reviewed messages ${status.retentionDays} days`,
    `Default SMS app: ${status.defaultSmsPackage ?? 'unknown'}${status.defaultSmsKnown === null ? '' : status.defaultSmsKnown ? ' (known)' : ' (NOT in the known SMS apps)'}`,
    `Payment apps read: ${status.monitoredApps.length === 0 ? 'none' : status.monitoredApps.join(', ')}`,
  ];
  if (status.counters !== null) {
    const c = status.counters;
    lines.push(
      `Listener: queued ${c.queued}, set aside as not payments ${c.rejected}, hidden by Android ${c.redacted}, unreadable ${c.unreadable}, errors ${c.errors}`,
      `Last alert read ${formatAgo(c.lastCaptureAt, now)}, last started ${formatAgo(c.lastConnectedAt, now)}`,
    );
  }
  lines.push(
    `Reader state: stored ${status.storedParserVersion ?? 'none'}, templates rev ${status.templatesRev} (re-read to ${status.templatesDoneRev ?? 'none'})`,
    `Waiting in the inbox: ${counts(status.pendingBySection)}`,
  );
  return lines;
}

function summaryLines(summary: DetectionSummary): string[] {
  const c = summary.corrections;
  const lines = [
    `Stored rows: ${summary.stored}${summary.oldestDays === null ? '' : `, oldest ${summary.oldestDays} days`} (older ones are cleared by retention)`,
    `By kind: ${counts(summary.byKind)}`,
    `By confidence: ${counts(summary.byConfidence)}`,
    `By status: ${counts(summary.byStatus)}`,
    `Pending rows read by an older reader: ${summary.readByOlderReader}`,
    `Confirmed exactly as read: ${c.confirmedAsRead}. Changed at confirm — amount ${c.amountChanged}, day ${c.dayChanged}, description ${c.itemChanged}, category ${c.categoryChanged}, account ${c.accountChanged}`,
    `Linked to an expense typed by hand ${c.linkedToTyped}, rescued from Filtered ${c.rescuedFromFiltered}, marked not a payment ${c.markedNotPayment}, duplicates ${c.duplicates}`,
    `Reasons: ${summary.reasons.length === 0 ? 'none' : summary.reasons.map(([reason, count]) => `${reason} ${count}`).join(', ')}`,
    '',
    'By sender (total, unknown, low, no payee, unclear amount, no date, not a payment, amount changed):',
  ];
  for (const row of summary.senders) {
    lines.push(
      `  ${row.key}: ${row.total}, ${row.unknown}, ${row.low}, ${row.noPayee}, ${row.ambiguousAmount}, ${row.fallbackDate}, ${row.notPayment}, ${row.amountChanged}`,
    );
  }
  if (summary.senders.length === 0) lines.push('  none');
  return lines;
}

function templateLines(templates: readonly TemplateFact[]): string[] {
  if (templates.length === 0) return ['Taught formats: none'];
  return [
    `Taught formats: ${templates.length} (${templates.filter((template) => template.isEnabled).length} on)`,
    ...templates.map((template) => {
      const who = [template.senderKey, template.issuer, template.packageName].filter((part) => part !== null).join(' / ');
      return `  ${who}: ${template.outcome}${template.direction === null ? '' : ` ${template.direction}`}${template.overridesGate === null ? '' : `, overrides ${template.overridesGate}`}, read ${template.timesMatched}, ${template.isEnabled ? 'on' : 'off'}`;
    }),
  ];
}

function shapeLines(shapes: readonly MessageShape[]): string[] {
  if (shapes.length === 0) return ['Message shapes: none to show'];
  const lines = ['Message shapes (every name, amount and number replaced; dates and times kept):'];
  shapes.forEach((shape, index) => {
    lines.push(
      '',
      `${index + 1}. ${shape.sender} — read as ${shape.kind}, ${shape.confidence} confidence (${shape.reasons.join(', ') || 'no reasons'})`,
      shape.skeleton,
    );
  });
  return lines;
}

export function buildSupportEmail(input: ReportInput, now: number = Date.now()): SupportEmail {
  const { sections } = input;
  const subject = `Finly ${input.app.version ?? ''}: ${input.topic === 'detection' ? 'detection problem' : 'feedback'}`.replace(
    /\s+:/,
    ':',
  );

  const userText = input.userText.trim();
  const bodyLines = [userText.length > 0 ? userText : '(No message written.)', ''];

  const file: string[] = [];
  const includeDetection = sections.detection && input.status !== null;

  if (sections.appDevice) {
    const lines = appDeviceLines(input.app, input.device);
    bodyLines.push(lines[0], lines[1], lines[2]);
    file.push('APP AND PHONE', ...lines, '');
  }

  if (includeDetection) {
    const status = input.status!;
    bodyLines.push(
      `Detection: ${status.enabled ? 'on' : 'off'}, access ${status.granted ? 'allowed' : 'not allowed'}, listener ${status.connected ? 'running' : 'not running'}${status.counters === null ? '' : `, last alert read ${formatAgo(status.counters.lastCaptureAt, now)}, hidden by Android ${status.counters.redacted}`}`,
    );
    file.push('DETECTION', ...statusLines(status, now), '');
    if (input.summary !== null) file.push('HOW DETECTION HAS GONE', ...summaryLines(input.summary), '');
    file.push(...templateLines(input.templates), '');
  }

  if (sections.shapes) {
    file.push(...shapeLines(input.shapes), '');
  }

  if (file.length === 0) {
    return { subject, body: bodyLines.join('\n').trim(), attachment: null };
  }

  const payload = {
    v: 1,
    topic: input.topic,
    app: sections.appDevice ? input.app : undefined,
    device: sections.appDevice ? input.device : undefined,
    status: includeDetection ? input.status : undefined,
    summary: includeDetection ? input.summary : undefined,
    templates: includeDetection ? input.templates : undefined,
    shapes: sections.shapes ? input.shapes : undefined,
  };
  file.push('MACHINE-READABLE', JSON.stringify(payload));

  bodyLines.push('', `The full details are in the attached ${REPORT_FILE}.`);
  return {
    subject,
    body: bodyLines.join('\n').trim(),
    attachment: { name: REPORT_FILE, text: file.join('\n') },
  };
}
