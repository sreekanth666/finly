import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { NotFound } from '@/components/not-found';
import { RuleEditor } from '@/components/rule-editor';
import { softDeleteRule, updateRule } from '@/db/repositories/rules';
import { useAction } from '@/db/use-action';
import { draftToInput, ruleToDraft } from '@/features/rules/mappers';
import { useRule } from '@/features/rules/hooks';

export default function EditRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /* Hooks above returns — the lookup is a query and flips between renders. */
  const rule = useRule(id);
  const save = useAction(updateRule);
  const remove = useAction(softDeleteRule);

  if (rule.error !== null) {
    return <NotFound title="Can't open this rule" description={rule.error.message} />;
  }

  const found = rule.data;
  if (found === null) {
    return (
      <NotFound title="Rule not found" description="It may have been deleted from another screen." />
    );
  }
  if (found === undefined) return null;

  return (
    <RuleEditor
      title="Edit rule"
      submitLabel="Save changes"
      initial={ruleToDraft(found)}
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage ?? remove.errorMessage}
      onDelete={() => {
        Alert.alert('Delete this rule?', 'Expenses it already filled in are not affected.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const outcome = await remove.run(found.id);
              if (outcome.ok) router.back();
            },
          },
        ]);
      }}
      onSubmit={async (draft) => {
        const outcome = await save.run(found.id, draftToInput(draft));
        if (outcome.ok) router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
