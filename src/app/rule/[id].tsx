import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { NotFound } from '@/components/not-found';
import { RuleEditor, type RuleDraft } from '@/components/rule-editor';
import { softDeleteRule, updateRule } from '@/db/repositories/rules';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { draftToInput, ruleToDraft } from '@/features/rules/mappers';
import { useRule } from '@/features/rules/hooks';

export default function EditRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /* Hooks above returns — the lookup is a query and flips between renders. */
  const rule = useRule(id);
  const save = useAction(updateRule);
  const remove = useAction(softDeleteRule);
  /* Above the early returns with the rest, so the rule id is passed at press
     time. Delete is not guarded here: its confirmation dialog dismisses on the
     first press, which is a stronger guard than this one. */
  const saveOnce = useSubmitOnce(async (id: string, draft: RuleDraft) => {
    const outcome = await save.run(id, draftToInput(draft));
    if (!outcome.ok) return false;
    router.back();
    return true;
  });

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
      onSubmit={(draft) => void saveOnce.submit(found.id, draft)}
      onClose={() => router.back()}
    />
  );
}
