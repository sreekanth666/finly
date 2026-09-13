import { router } from 'expo-router';
import { Switch, Typography } from 'heroui-native';
import { ArrowLeft, BookOpenText, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TemplateShare } from '@/components/template-share';
import { UndoToast } from '@/components/undo-toast';
import type { TemplateListItem } from '@/db/repositories/templates';
import { appHint } from '@/domain/txn-detect';
import {
  toSpec,
  useDeleteTemplate,
  useRestoreTemplate,
  useSetTemplateEnabled,
  useTemplates,
} from '@/features/capture/templates';
import { useNavigateOnce } from '@/features/navigation/hooks';

const OUTCOME_WORDS: Record<TemplateListItem['outcome'], string> = {
  transaction: 'Payment',
  transfer: 'Transfer',
  ignore: 'Muted',
};

const senderOf = (item: TemplateListItem) =>
  [item.binding.senderKey, item.binding.issuer, appHint(item.binding.packageName)?.name]
    .filter((part): part is string => part != null)
    .join(' · ');

function TemplateRow({
  item,
  onToggle,
}: {
  item: TemplateListItem;
  onToggle: (next: boolean) => void;
}) {
  const [isSharing, setIsSharing] = useState(false);
  const used = item.timesMatched === 0 ? 'Not used yet' : item.timesMatched === 1 ? 'Read 1 new alert' : `Read ${item.timesMatched} new alerts`;

  return (
    <View className="gap-3 rounded-2xl bg-surface px-4 py-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Typography type="body-sm" weight="semibold" truncate>
            {item.name}
          </Typography>
          <Typography type="body-xs" color="muted" truncate>
            {`${OUTCOME_WORDS[item.outcome]} · ${senderOf(item)}`}
          </Typography>
          <Typography type="body-xs" color="muted">
            {used}
          </Typography>
        </View>
        <Switch isSelected={item.isEnabled} onSelectedChange={onToggle} accessibilityLabel={`Use ${item.name}`} />
      </View>
      {isSharing ? (
        <TemplateShare
          maskedMessage={item.sampleMasked}
          template={toSpec(item)}
          sender={item.binding.senderKey ?? item.binding.issuer}
          initiallyOpen
        />
      ) : (
        <Button label="Send to the developer" tone="secondary" size="sm" onPress={() => setIsSharing(true)} />
      )}
    </View>
  );
}

/**
 * The formats the user taught (D18): what each reads, how often it has, a
 * switch to stop using one, and a way to send it to the developer so the next
 * update reads it for everyone.
 */
export default function TemplatesScreen() {
  const navigate = useNavigateOnce();
  const templates = useTemplates();
  const toggle = useSetTemplateEnabled();
  const remove = useDeleteTemplate();
  const restore = useRestoreTemplate();
  const [undoable, setUndoable] = useState<{ id: string; name: string } | null>(null);

  const failure = toggle.errorMessage ?? remove.errorMessage ?? restore.errorMessage;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold" className="flex-1">
          Message formats
        </Typography>
        <IconButton icon={Plus} label="Teach a new format" onPress={() => navigate('/settings/templates/editor')} />
      </View>

      {templates.error !== null ? (
        <ErrorState error={templates.error} onRetry={templates.refetch} />
      ) : (
        <ScrollView contentContainerClassName="gap-4 px-5 pb-8 pt-4" showsVerticalScrollIndicator={false}>
          <Typography type="body-sm" color="muted">
            Formats you taught Finly. Each one only reads messages from the sender it was taught on, and switching
            one off puts its messages back to the usual reading.
          </Typography>

          {failure !== null && (
            <Typography type="body-xs" className="text-danger">
              {failure}
            </Typography>
          )}

          {templates.data !== undefined && templates.data.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title="No formats yet"
              description="When Finly misreads a payment alert, open it in the review inbox and tap “Teach Finly this format”. Or paste one here."
              action={{ label: 'Teach a format', icon: Plus, onPress: () => navigate('/settings/templates/editor') }}
            />
          ) : (
            (templates.data ?? []).map((item) => (
              <SwipeToDelete
                key={item.id}
                accessibilityLabel={item.name}
                onDelete={async () => {
                  const outcome = await remove.run(item.id);
                  if (outcome.ok) setUndoable({ id: item.id, name: item.name });
                }}>
                <TemplateRow item={item} onToggle={(next) => void toggle.run(item.id, next)} />
              </SwipeToDelete>
            ))
          )}
        </ScrollView>
      )}

      {undoable !== null && (
        <UndoToast
          message={`Deleted “${undoable.name}”`}
          onUndo={async () => {
            await restore.run(undoable.id);
            setUndoable(null);
          }}
          onExpire={() => setUndoable(null)}
        />
      )}
    </SafeAreaView>
  );
}
