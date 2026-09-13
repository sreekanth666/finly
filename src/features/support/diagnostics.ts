/**
 * Everything a report to the developer can say, gathered live (D19).
 *
 * The screen composes the email from this as the user switches sections on
 * and off, so the preview is always exactly what will be sent.
 */

import Constants from 'expo-constants';
import { useMemo } from 'react';
import { PixelRatio, Platform } from 'react-native';

import { useDbQuery } from '@/db/live';
import { listDetectionFacts, listProblemMessages, listTemplateFacts } from '@/db/repositories/diagnostics';
import { getSetting } from '@/db/repositories/settings';
import { templatesRev } from '@/db/repositories/templates';
import { getActiveCurrency } from '@/domain/money';
import { senderKeyOf, summariseDetections, type DetectionSummary } from '@/domain/support/diagnostics';
import type { AppInfo, DetectionStatus, DeviceInfo, MessageShape, TemplateFact } from '@/domain/support/report';
import { skeletonOf } from '@/domain/support/skeleton';
import { appHint, PARSER_VERSION, SMS_APP_PACKAGES } from '@/domain/txn-detect';
import { useCaptureSettings, useInbox } from '@/features/capture/hooks';
import { captureNative, useListenerState, useNativeStats } from '@/features/capture/native';

/** How many stored rows a report looks at, and how many message shapes it may carry. */
const FACT_LIMIT = 2000;
const SHAPE_LIMIT = 10;

const pick = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/**
 * The phone, field by field. `Platform.constants` also holds the serial number
 * and the build fingerprint on Android, so it is never passed on whole.
 */
function readDevice(): DeviceInfo {
  const constants = Platform.constants as Record<string, unknown>;
  const locale = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
    } catch {
      return null;
    }
  })();
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  })();
  return {
    os: Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : Platform.OS,
    osVersion: pick(constants.Release) ?? (typeof Platform.Version === 'string' ? Platform.Version : null),
    apiLevel: Platform.OS === 'android' && typeof Platform.Version === 'number' ? Platform.Version : null,
    manufacturer: pick(constants.Manufacturer),
    brand: pick(constants.Brand),
    model: pick(constants.Model),
    locale,
    timeZone,
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
    currency: getActiveCurrency().code,
    fontScale: Math.round(PixelRatio.getFontScale() * 100) / 100,
  };
}

const readApp = (): AppInfo => ({
  version: Constants.expoConfig?.version ?? null,
  build: __DEV__ ? 'development' : 'release',
  parserVersion: PARSER_VERSION,
});

export type Diagnostics = {
  app: AppInfo;
  device: DeviceInfo;
  status: DetectionStatus | null;
  summary: DetectionSummary | null;
  templates: TemplateFact[];
  shapes: MessageShape[];
};

/**
 * @param withShapes read problem messages and turn them into skeletons. Off,
 * no message text is read at all.
 */
export function useDiagnostics(withShapes: boolean): Diagnostics {
  const facts = useDbQuery('support:facts', ['detected_transactions', 'captured_messages', 'expenses'], (database) =>
    listDetectionFacts(FACT_LIMIT, database),
  );
  const templates = useDbQuery('support:templates', ['capture_templates'], (database) => listTemplateFacts(database));
  const parser = useDbQuery('support:parser', ['settings'], (database) => ({
    stored: getSetting('capture_parser_version', database),
    rev: templatesRev(database),
    done: getSetting('capture_templates_done_rev', database),
  }));
  const problems = useDbQuery(`support:problems:${withShapes}`, ['detected_transactions', 'captured_messages'], (database) =>
    withShapes ? listProblemMessages(SHAPE_LIMIT, database) : [],
  );
  const settings = useCaptureSettings();
  const inbox = useInbox();
  const { state } = useListenerState();
  const counters = useNativeStats();

  const [app, device] = useMemo(() => [readApp(), readDevice()] as const, []);
  const defaultSms = useMemo(() => {
    try {
      return captureNative?.getDefaultSmsPackage() ?? null;
    } catch {
      return null;
    }
  }, []);

  const summary = useMemo(
    () => (facts.data === undefined ? null : summariseDetections(facts.data, { parserVersion: PARSER_VERSION })),
    [facts.data],
  );

  const status = useMemo<DetectionStatus | null>(() => {
    const current = settings.data;
    if (current === undefined) return null;
    return {
      available: state.available,
      enabled: current.enabled,
      disclosureAccepted: current.disclosureAcceptedAt !== null,
      granted: state.granted,
      connected: state.connected,
      notify: current.notify,
      retentionDays: current.retentionDays,
      defaultSmsPackage: defaultSms,
      defaultSmsKnown: defaultSms === null ? null : SMS_APP_PACKAGES.includes(defaultSms),
      monitoredApps: current.packages.map((name) => appHint(name)?.name ?? name),
      counters: counters ?? null,
      storedParserVersion: parser.data?.stored ?? null,
      templatesRev: parser.data?.rev ?? 0,
      templatesDoneRev: parser.data?.done ?? null,
      pendingBySection: {
        review: inbox.data?.review.length ?? 0,
        maybe: inbox.data?.maybe.length ?? 0,
        money_in: inbox.data?.money_in.length ?? 0,
        filtered: inbox.data?.filtered.length ?? 0,
      },
    };
  }, [settings.data, state, defaultSms, counters, parser.data, inbox.data]);

  const shapes = useMemo<MessageShape[]>(
    () =>
      (problems.data ?? []).map((message) => {
        let reasons: string[] = [];
        try {
          const parsed: unknown = JSON.parse(message.reasons);
          if (Array.isArray(parsed)) reasons = parsed.filter((entry): entry is string => typeof entry === 'string');
        } catch {
          reasons = [];
        }
        return {
          sender: senderKeyOf(message),
          kind: message.kind,
          confidence: message.confidence,
          reasons: reasons.map((reason) => (reason.startsWith('template:') ? 'template' : reason)),
          skeleton: skeletonOf(message.body),
        };
      }),
    [problems.data],
  );

  return { app, device, status, summary, templates: templates.data ?? [], shapes };
}
