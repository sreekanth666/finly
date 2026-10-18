import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, ClipboardPaste, Inbox, ListChecks, Settings2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, SectionList, View } from 'react-native';

import { Button } from '@/components/button';
import { CandidateRow } from '@/components/candidate-row';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { UndoToast } from '@/components/undo-toast';
import type { CandidateSummary } from '@/db/repositories/captures';
import { getActiveCurrency } from '@/domain/money';
import {
  batchPrompt,
  canConfirmInOneTap,
  INBOX_SECTIONS,
  splitForAdd,
  type BatchPrompt,
  type InboxSection,
} from '@/domain/txn-detect';
import {
  useAddCandidates,
  useCaptureEnabled,
  useConfirmAsRead,
  useDismissCandidates,
  useInbox,
  useResolveCandidate,
  useRestoreCandidates,
  useUndoConfirms,
} from '@/features/capture/hooks';
import { SECTION_HINTS, SECTION_TITLES } from '@/features/capture/presentation';
import { useNavigateOnce } from '@/features/navigation/hooks';

type Section = { key: InboxSection; data: CandidateSummary[]; total: number };

/** What the toast offers to take back, and how. */
type Undoable = { ids: string[]; message: string; action: 'restore' | 'unconfirm' };

const EMPTY: readonly CandidateSummary[] = [];

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** Every batch action asks first: it decides many things the user has not looked at one by one. */
function confirmFirst(prompt: BatchPrompt, onConfirm: () => void) {
  Alert.alert(prompt.title, prompt.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: prompt.confirmLabel, style: prompt.destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/**
 * The review inbox (D17): everything read from payment alerts, waiting for a
 * decision. Nothing here has touched the budget yet.
 */
export default function InboxScreen() {
  /* One push per press: a row stays tappable for the whole transition. */
  const navigate = useNavigateOnce();

  const inbox = useInbox();
  const enabled = useCaptureEnabled();
  const confirm = useConfirmAsRead();
  const addMany = useAddCandidates();
  const resolve = useResolveCandidate();
  const dismissMany = useDismissCandidates();
  const restoreMany = useRestoreCandidates();
  const unconfirmMany = useUndoConfirms();

  const [showFiltered, setShowFiltered] = useState(false);
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [marks, setMarks] = useState<ReadonlySet<string>>(() => new Set());

  const sections = useMemo<Section[]>(() => {
    const data = inbox.data;
    if (data === undefined) return [];
    return INBOX_SECTIONS.filter((key) => data[key].length > 0).map((key) => ({
      key,
      total: data[key].length,
      /* Filtered is collapsed until asked for: it is the noise the other three
         sections exist to keep out of the way. */
      data: key === 'filtered' && !showFiltered ? [] : data[key],
    }));
  }, [inbox.data, showFiltered]);

  /* "All" means what the screen shows without asking: Filtered has its own. */
  const visible = useMemo(
    () => (inbox.data === undefined ? EMPTY : [...inbox.data.review, ...inbox.data.maybe, ...inbox.data.money_in]),
    [inbox.data],
  );
  const filtered = inbox.data?.filtered ?? EMPTY;
  const shown = useMemo(() => sections.flatMap((section) => section.data), [sections]);

  const currency = getActiveCurrency().code;
  const addAll = useMemo(() => splitForAdd(visible, currency), [visible, currency]);

  /* Marks are kept against what is still waiting: one dealt with elsewhere, or
     hidden by collapsing Filtered, drops out of the count. */
  const marked = useMemo(() => shown.filter((candidate) => marks.has(candidate.id)), [shown, marks]);
  const isSelecting = selecting && shown.length > 0;

  const stopSelecting = () => {
    setSelecting(false);
    setMarks(new Set());
  };

  useEffect(() => {
    if (!isSelecting) return;
    /* Back leaves marking before it leaves the screen. */
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelecting(false);
      setMarks(new Set());
      return true;
    });
    return () => subscription.remove();
  }, [isSelecting]);

  const errorMessage =
    confirm.errorMessage ??
    addMany.errorMessage ??
    resolve.errorMessage ??
    dismissMany.errorMessage ??
    restoreMany.errorMessage ??
    unconfirmMany.errorMessage;

  const confirmOne = async (candidate: CandidateSummary) => {
    const outcome = await confirm.run(candidate);
    if (outcome.ok) setUndoable({ ids: [candidate.id], message: `Added “${candidate.item}”`, action: 'unconfirm' });
  };

  const dismiss = async (candidate: CandidateSummary) => {
    const outcome = await resolve.run(candidate.id, 'dismissed');
    if (outcome.ok) setUndoable({ ids: [candidate.id], message: `Dismissed “${candidate.item}”`, action: 'restore' });
  };

  const add = (candidates: readonly CandidateSummary[]) => {
    const { addable, skipped } = splitForAdd(candidates, currency);
    if (addable.length === 0) {
      Alert.alert('Nothing to add as read', 'None of these can be added without a look. Open each one to confirm it.');
      return;
    }
    confirmFirst(batchPrompt('add', addable.length, skipped.length), async () => {
      const outcome = await addMany.run(addable);
      if (!outcome.ok) return;
      stopSelecting();
      setUndoable({ ids: outcome.value, message: `Added ${counted(outcome.value.length, 'payment', 'payments')}`, action: 'unconfirm' });
    });
  };

  const discard = (candidates: readonly CandidateSummary[], action: 'discard' | 'discard_filtered') => {
    if (candidates.length === 0) return;
    const ids = candidates.map((candidate) => candidate.id);
    confirmFirst(batchPrompt(action, ids.length), async () => {
      const outcome = await dismissMany.run(ids);
      if (!outcome.ok) return;
      stopSelecting();
      setUndoable({ ids, message: `Discarded ${counted(ids.length, 'item', 'items')}`, action: 'restore' });
    });
  };

  const toggleMark = (id: string) =>
    setMarks((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const allMarked = marked.length === shown.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {isSelecting ? (
        <View className="flex-row items-center gap-1 px-3 pt-2">
          <IconButton icon={X} label="Stop marking" onPress={stopSelecting} />
          <Typography type="body" weight="semibold" className="flex-1">
            {`${marked.length} marked`}
          </Typography>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setMarks(allMarked ? new Set() : new Set(shown.map((candidate) => candidate.id)))}
            className="px-3 active:opacity-60">
            <Typography type="body-sm" className="text-link">
              {allMarked ? 'Clear' : 'Mark all'}
            </Typography>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center gap-1 px-3 pt-2">
          <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
          <Typography type="body" weight="semibold" className="flex-1">
            Review
          </Typography>
          {shown.length > 0 && (
            <IconButton icon={ListChecks} label="Mark items" onPress={() => setSelecting(true)} />
          )}
          <IconButton icon={ClipboardPaste} label="Paste a message" onPress={() => navigate('/inbox/paste')} />
          <IconButton icon={Settings2} label="Detection settings" onPress={() => navigate('/settings/capture')} />
        </View>
      )}

      {!isSelecting && visible.length > 0 && (
        <View className="flex-row gap-2 px-5 pt-3">
          {addAll.addable.length > 0 && (
            <Button
              label={`Add all ${addAll.addable.length}`}
              size="sm"
              isDisabled={addMany.isPending}
              accessibilityLabel={`Add all ${addAll.addable.length} payments read with confidence`}
              onPress={() => add(visible)}
            />
          )}
          <Button
            label="Discard all"
            tone="secondary"
            size="sm"
            isDisabled={dismissMany.isPending}
            accessibilityLabel={`Discard all ${visible.length} items waiting for review`}
            onPress={() => discard(visible, 'discard')}
          />
        </View>
      )}

      {errorMessage !== null && (
        <Typography type="body-xs" className="px-5 pt-2 text-danger">
          {errorMessage}
        </Typography>
      )}

      {inbox.error !== null ? (
        <ErrorState error={inbox.error} onRetry={inbox.refetch} />
      ) : (
        <SectionList
          className="flex-1"
          sections={sections}
          keyExtractor={(candidate) => candidate.id}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="px-5 pb-8"
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View className="gap-1 pb-2 pt-5">
              <View className="flex-row items-center gap-2">
                <Typography type="body-sm" weight="semibold" className="flex-1">
                  {`${SECTION_TITLES[section.key]} · ${section.total}`}
                </Typography>
                {section.key === 'filtered' && !isSelecting && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Discard all ${section.total} filtered items`}
                    hitSlop={8}
                    disabled={dismissMany.isPending}
                    onPress={() => discard(filtered, 'discard_filtered')}>
                    <Typography type="body-xs" className="text-link">
                      Discard all
                    </Typography>
                  </Pressable>
                )}
                {section.key === 'filtered' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showFiltered }}
                    hitSlop={8}
                    onPress={() => setShowFiltered((current) => !current)}>
                    <Typography type="body-xs" className="text-link">
                      {showFiltered ? 'Hide' : 'Show'}
                    </Typography>
                  </Pressable>
                )}
              </View>
              <Typography type="body-xs" color="muted">
                {SECTION_HINTS[section.key]}
              </Typography>
            </View>
          )}
          renderItem={({ item: candidate }) =>
            isSelecting ? (
              <CandidateRow
                candidate={candidate}
                selecting
                marked={marks.has(candidate.id)}
                onPress={() => toggleMark(candidate.id)}
              />
            ) : (
              <SwipeToDelete
                accessibilityLabel={candidate.item}
                actionLabel="Dismiss"
                actionIcon={X}
                onDelete={() => void dismiss(candidate)}>
                <CandidateRow
                  candidate={candidate}
                  onPress={() => navigate(`/inbox/${candidate.id}`)}
                  onConfirm={canConfirmInOneTap(candidate, currency) ? () => void confirmOne(candidate) : undefined}
                />
              </SwipeToDelete>
            )
          }
          ListFooterComponent={
            enabled.data === true ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate({ pathname: '/settings/contact', params: { topic: 'detection' } })}
                className="self-center py-6 active:opacity-60">
                <Typography type="body-xs" className="text-link">
                  Payment alert not showing up? Tell the developer
                </Typography>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            inbox.data === undefined ? null : (
              <EmptyState
                icon={Inbox}
                title="Nothing to review"
                description={
                  enabled.data === true
                    ? 'Payments read from your notifications will wait here until you confirm them.'
                    : 'Turn on transaction detection to have payments waiting here, or paste a payment message yourself.'
                }
                action={
                  enabled.data === true
                    ? { label: 'Paste a message', icon: ClipboardPaste, onPress: () => navigate('/inbox/paste') }
                    : { label: 'Set up detection', icon: Settings2, onPress: () => navigate('/settings/capture') }
                }
              />
            )
          }
        />
      )}

      {isSelecting && (
        <View className="flex-row gap-2 border-t border-border px-5 pt-3">
          <View className="flex-1">
            <Button
              label="Add marked"
              isDisabled={marked.length === 0 || addMany.isPending}
              accessibilityLabel={`Add ${marked.length} marked`}
              onPress={() => add(marked)}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Discard marked"
              tone="secondary"
              isDisabled={marked.length === 0 || dismissMany.isPending}
              accessibilityLabel={`Discard ${marked.length} marked`}
              onPress={() => discard(marked, 'discard')}
            />
          </View>
        </View>
      )}

      {undoable !== null && (
        <UndoToast
          message={undoable.message}
          onUndo={async () => {
            if (undoable.action === 'restore') await restoreMany.run(undoable.ids);
            else await unconfirmMany.run(undoable.ids);
            setUndoable(null);
          }}
          onExpire={() => setUndoable(null)}
        />
      )}
    </SafeAreaView>
  );
}
