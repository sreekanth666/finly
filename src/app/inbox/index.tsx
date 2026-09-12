import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, ClipboardPaste, Inbox, Settings2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';

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
import { canConfirmInOneTap, INBOX_SECTIONS, type InboxSection } from '@/domain/txn-detect';
import {
  useCaptureEnabled,
  useConfirmAllCertain,
  useConfirmAsRead,
  useInbox,
  useResolveCandidate,
  useRestoreCandidate,
  useUndoConfirm,
} from '@/features/capture/hooks';
import { SECTION_HINTS, SECTION_TITLES } from '@/features/capture/presentation';
import { useNavigateOnce } from '@/features/navigation/hooks';

type Section = { key: InboxSection; data: CandidateSummary[]; total: number };

/** What the toast offers to take back, and how. */
type Undoable = { id: string; message: string; action: 'restore' | 'unconfirm' };

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
  const confirmAll = useConfirmAllCertain();
  const resolve = useResolveCandidate();
  const restore = useRestoreCandidate();
  const unconfirm = useUndoConfirm();

  const [showFiltered, setShowFiltered] = useState(false);
  const [undoable, setUndoable] = useState<Undoable | null>(null);

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

  const currency = getActiveCurrency().code;
  const certain = useMemo(
    () => (inbox.data?.review ?? []).filter((candidate) => canConfirmInOneTap(candidate, currency)),
    [inbox.data, currency],
  );

  const errorMessage =
    confirm.errorMessage ?? confirmAll.errorMessage ?? resolve.errorMessage ?? restore.errorMessage ?? unconfirm.errorMessage;

  const confirmOne = async (candidate: CandidateSummary) => {
    const outcome = await confirm.run(candidate);
    if (outcome.ok) setUndoable({ id: candidate.id, message: `Added “${candidate.item}”`, action: 'unconfirm' });
  };

  const dismiss = async (candidate: CandidateSummary) => {
    const outcome = await resolve.run(candidate.id, 'dismissed');
    if (outcome.ok) setUndoable({ id: candidate.id, message: `Dismissed “${candidate.item}”`, action: 'restore' });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold" className="flex-1">
          Review
        </Typography>
        <IconButton icon={ClipboardPaste} label="Paste a message" onPress={() => navigate('/inbox/paste')} />
        <IconButton icon={Settings2} label="Detection settings" onPress={() => navigate('/settings/capture')} />
      </View>

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
                {section.key === 'review' && certain.length > 1 && (
                  <Button
                    label={`Confirm ${certain.length}`}
                    size="sm"
                    isDisabled={confirmAll.isPending}
                    accessibilityLabel={`Confirm all ${certain.length} payments read with confidence`}
                    onPress={() => void confirmAll.run(certain)}
                  />
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
          renderItem={({ item: candidate }) => (
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
          )}
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

      {undoable !== null && (
        <UndoToast
          message={undoable.message}
          onUndo={async () => {
            if (undoable.action === 'restore') await restore.run(undoable.id);
            else await unconfirm.run(undoable.id);
            setUndoable(null);
          }}
          onExpire={() => setUndoable(null)}
        />
      )}
    </SafeAreaView>
  );
}
