'use no memo';
/*
 * The widget renderer calls these components as plain functions to flatten them
 * into a native view tree. The React Compiler would add a cache hook to each,
 * and a hook outside a React render throws — hence the opt-out above.
 */

import {
  FlexWidget,
  SvgWidget,
  TextWidget,
  type ColorProp,
} from 'react-native-android-widget';

import type { WidgetPalette } from './palette';
import type { WidgetState } from './read';

import type { GlanceTone } from '@/domain/glance';
import { formatMinor, speakMinor } from '@/domain/money';
import { formatPeriodMonth } from '@/domain/period';

/** Must match the `name` in the react-native-android-widget entry in app.json. */
export const WIDGET_NAME = 'MonthGlance';

const HOME_URI = 'finly:///';
const ADD_EXPENSE_URI = 'finly://expense/new';

/* Font families the config plugin copies into the Android assets, by file name.
   The same faces as the Balance screen: Inter Bold for money, Medium for labels. */
const FONT_FIGURE = 'Inter-Bold';
const FONT_LABEL = 'Inter-Medium';

const RADIUS = 24;
const LINE_HEIGHT = 6;
const BUTTON_SIZE = 44;

type Props = {
  state: WidgetState;
  palette: WidgetPalette | null;
};

/** Below the top-level null check, where there is always a palette to paint with. */
type Painted = {
  state: WidgetState;
  palette: WidgetPalette;
};

export function MonthGlanceWidget({ state, palette }: Props) {
  /* Only before the app has ever run — the palette is cached on first launch.
     Nothing to paint with, so the plainest thing that still opens the app. */
  if (palette === null) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center' }}
      >
        <TextWidget text="Open Finly" style={{ fontSize: 14 }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: HOME_URI }}
      accessibilityLabel={describe(state)}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: palette.surface,
        borderRadius: RADIUS,
        paddingHorizontal: 20,
        paddingVertical: 18,
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-start' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <Eyebrow state={state} palette={palette} />
          <Headline state={state} palette={palette} />
        </FlexWidget>
        <AddButton palette={palette} />
      </FlexWidget>

      {/* Takes the slack, so the line sits on the bottom edge at any height. */}
      <FlexWidget style={{ flex: 1 }} />

      {state.kind === 'glance' && (
        <UsageLine
          fill={state.glance.fill}
          percent={state.glance.percent}
          color={toneColor(state.glance.tone, palette)}
          palette={palette}
        />
      )}
    </FlexWidget>
  );
}

function Eyebrow({ state, palette }: Painted) {
  return (
    <TextWidget
      text={state.kind === 'unavailable' ? 'FINLY' : formatPeriodMonth(state.period).toUpperCase()}
      style={{ fontFamily: FONT_LABEL, fontSize: 11, letterSpacing: 1.4, color: palette.muted }}
    />
  );
}

function Headline({ state, palette }: Painted) {
  if (state.kind !== 'glance') {
    return (
      <TextWidget
        text={state.kind === 'locked' ? 'Locked' : 'Open Finly to see this month'}
        maxLines={1}
        truncate="END"
        style={{ marginTop: 8, fontFamily: FONT_LABEL, fontSize: 15, color: palette.muted }}
      />
    );
  }

  const { glance, currency } = state;
  return (
    <FlexWidget style={{ flexDirection: 'column' }}>
      <TextWidget
        text={formatMinor(glance.spent, { currency, showFraction: false })}
        maxLines={1}
        style={{
          marginTop: 6,
          fontFamily: FONT_FIGURE,
          fontSize: 28,
          letterSpacing: -0.5,
          color: palette.foreground,
        }}
      />
      <TextWidget
        text={`of ${formatMinor(glance.available, { currency, showFraction: false })}`}
        maxLines={1}
        style={{ marginTop: 2, fontFamily: FONT_LABEL, fontSize: 13, color: palette.muted }}
      />
    </FlexWidget>
  );
}

function AddButton({ palette }: { palette: WidgetPalette }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: ADD_EXPENSE_URI }}
      accessibilityLabel="Add expense"
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: palette.accent,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <SvgWidget svg={plusIcon(palette.onAccent)} style={{ width: 20, height: 20 }} />
    </FlexWidget>
  );
}

/**
 * A thin line filled by flex weight rather than measured width, so it tracks
 * the widget through a resize without knowing how wide it is. A zero weight
 * means "no weight" to the renderer, so an empty or full line drops that half.
 */
function UsageLine({
  fill,
  percent,
  color,
  palette,
}: {
  fill: number;
  percent: number | null;
  color: ColorProp;
  palette: WidgetPalette;
}) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget
        style={{
          flex: 1,
          height: LINE_HEIGHT,
          flexDirection: 'row',
          backgroundColor: palette.track,
          borderRadius: LINE_HEIGHT / 2,
        }}
      >
        {fill > 0 && (
          <FlexWidget
            style={{
              flex: fill,
              height: LINE_HEIGHT,
              backgroundColor: color,
              borderRadius: LINE_HEIGHT / 2,
            }}
          />
        )}
        {fill < 1 && <FlexWidget style={{ flex: 1 - fill, height: LINE_HEIGHT }} />}
      </FlexWidget>
      <TextWidget
        text={percent === null ? 'Over' : `${percent}%`}
        style={{ marginLeft: 12, fontFamily: FONT_FIGURE, fontSize: 13, color }}
      />
    </FlexWidget>
  );
}

function toneColor(tone: GlanceTone, palette: WidgetPalette): ColorProp {
  switch (tone) {
    case 'healthy':
      return palette.accent;
    case 'high':
      return palette.warning;
    case 'critical':
    case 'over':
      return palette.danger;
  }
}

/** Lucide's plus, stroked in the token the button's foreground uses. */
const plusIcon = (stroke: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;

/** One utterance for the whole widget, instead of a screen reader stepping through fragments. */
function describe(state: WidgetState): string {
  switch (state.kind) {
    case 'unavailable':
      return 'Finly. Open the app to see this month.';
    case 'locked':
      return `Finly, ${formatPeriodMonth(state.period)}. Locked.`;
    case 'glance': {
      const { glance, currency } = state;
      const spent = speakMinor(glance.spent, currency);
      const available = speakMinor(glance.available, currency);
      const used = glance.percent === null ? 'over budget' : `${glance.percent} percent used`;
      return `Finly, ${formatPeriodMonth(state.period)}. Spent ${spent} of ${available}, ${used}.`;
    }
  }
}
