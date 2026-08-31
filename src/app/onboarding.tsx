import { router } from 'expo-router';
import { Input, Typography } from 'heroui-native';
import { ArrowRight, FileSpreadsheet, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AmountKeypad } from '@/components/amount-keypad';
import { Button } from '@/components/button';
import { CurrencyPicker } from '@/components/currency-picker';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { StepIndicator } from '@/components/step-indicator';
import { createAccount } from '@/db/repositories/accounts';
import { setDefaultMonthlyBudget } from '@/db/repositories/budgets';
import {
  getCurrency,
  setCurrency,
  setFlag,
  setProfileName,
} from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { useDbQuery } from '@/db/live';
import { appendKey, type KeypadKey } from '@/domain/amount-entry';
import {
  entryToMinor,
  formatEntry,
  minorToEntry,
  rupees,
  setActiveCurrency,
  type Currency,
} from '@/domain/money';

const STEPS = ['You', 'Currency', 'Budget', 'Account'];

/**
 * First run.
 *
 * §5 seeds categories and a default budget but deliberately no accounts — "the
 * user adds their own, prompted once". This is that prompt, and without it card
 * utilisation, one of the four reasons §1 gives for the app existing, was
 * unreachable unless the user went looking for it in Settings.
 *
 * Every step is skippable. Nothing here is information the app cannot work
 * without, and a wall between someone and their first expense is a worse
 * outcome than an unset budget.
 *
 * The name goes first because it is the only step that changes how the app
 * speaks rather than what it calculates, and asking it after the money
 * questions would read as an afterthought.
 */
export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  const stored = useDbQuery('onboarding:currency', ['settings'], (database) =>
    getCurrency(database),
  );
  const [currency, setCurrencyChoice] = useState<Currency | null>(null);
  const active = currency ?? stored.data ?? null;

  const [name, setName] = useState('');
  const [entry, setEntry] = useState(minorToEntry(rupees(5000)));
  const [accountName, setAccountName] = useState('');

  const finish = useAction(
    (profileName: string, chosen: Currency | null, budgetEntry: string, cardName: string) => {
      /* Skipped is a real answer, and the repository turns an empty string into
         a deleted key rather than a name that is blank. */
      setProfileName(profileName);

      if (chosen !== null) {
        setCurrency(chosen);
        setActiveCurrency(chosen);
      }

      const budget = entryToMinor(budgetEntry);
      if (budget > 0) setDefaultMonthlyBudget(budget);

      /* Named `account` rather than `name`, which now belongs to the profile
         step and would be shadowed here. */
      const account = cardName.trim();
      if (account.length > 0) {
        /* A bank account, not a card: a card needs a credit limit, and asking
           for one here would turn a two-tap step into a form. */
        createAccount({ name: account, type: 'bank', colorToken: 'accent' }, undefined);
      }

      setFlag('onboarding_done', true);
    },
  );

  const complete = async () => {
    const outcome = await finish.run(name, currency, entry, accountName);
    if (!outcome.ok) return;
    /* Replaced rather than pushed: onboarding is the root of the stack, and
       nobody should be able to swipe back into a flow they have finished. */
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="gap-5 px-5 pt-4">
        <View className="gap-1">
          <Typography.Heading type="h2" weight="bold">
            Welcome to Finly
          </Typography.Heading>
          <Typography type="body-sm" color="muted">
            Four quick things. You can change all of them later.
          </Typography>
        </View>
        <StepIndicator steps={STEPS} current={step} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-6 pt-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View className="gap-3">
            <Typography type="body-sm" weight="semibold">
              What should we call you?
            </Typography>
            <NameField value={name} onChangeText={setName} />
            <Typography type="body-xs" color="muted" className="px-1">
              Only ever stored on this phone, and only used to say hello. Leave it
              blank if you would rather not.
            </Typography>
          </View>
        )}

        {step === 1 && (
          <View className="gap-3">
            <Typography type="body-sm" weight="semibold">
              Which currency do you spend in?
            </Typography>
            {active !== null && (
              <CurrencyPicker
                selected={active.code}
                onSelect={(next) => {
                  setCurrencyChoice(next);
                  /* Applied straight away so the budget step, which is the very
                     next screen, is already written in the right symbol. */
                  setActiveCurrency(next);
                }}
              />
            )}
          </View>
        )}

        {step === 2 && (
          <View className="gap-3">
            <Typography type="body-sm" weight="semibold">
              How much do you want to spend a month?
            </Typography>
            <View className="items-center py-4">
              <Typography className="type-metric text-foreground">{formatEntry(entry)}</Typography>
            </View>
            <AmountKeypad
              onKeyPress={(key: KeypadKey) => setEntry((current) => appendKey(current, key))}
            />
            <Typography type="body-xs" color="muted" className="px-1">
              Only overspending carries into the next month, and it compounds. You can change this
              whenever you like.
            </Typography>
          </View>
        )}

        {step === 3 && (
          <View className="gap-3">
            <Typography type="body-sm" weight="semibold">
              What do you usually pay from?
            </Typography>
            <View className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-3.5">
              <Icon icon={Wallet} color="accent" size={18} />
              <View className="flex-1">
                <Typography type="body-sm" weight="medium">
                  {accountName.trim().length > 0 ? accountName : 'No account yet'}
                </Typography>
              </View>
            </View>
            <AccountNameField value={accountName} onChangeText={setAccountName} />
            <Typography type="body-xs" color="muted" className="px-1">
              Add your credit cards in Settings afterwards — with a limit and a statement day,
              Finly can show what each one is carrying this cycle.
            </Typography>

            {/* A detour, not an exit. Pushed with onboarding left underneath, so
                closing the importer comes back to this step with the currency,
                budget and name already entered still filled in — and the flow
                is still finished by Skip or Finish, once, below. The importer
                creates any account named in the file itself, so it does not
                need this step to have been completed first. */}
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/settings/import')}
              className="flex-row items-center gap-2 self-start pt-1 active:opacity-60">
              <Icon icon={FileSpreadsheet} color="accent" size={14} />
              <Typography type="body-sm" className="text-link">
                I have a spreadsheet to import
              </Typography>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View className="gap-3 border-t border-border px-5 pt-3">
        {finish.errorMessage !== null && (
          <Typography type="body-xs" className="text-danger">
            {finish.errorMessage}
          </Typography>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              tone="secondary"
              label={step === STEPS.length - 1 ? 'Skip' : 'Skip for now'}
              onPress={() => void complete()}
            />
          </View>
          <View className="flex-1">
            <Button
              label={step === STEPS.length - 1 ? 'Finish' : 'Next'}
              icon={step === STEPS.length - 1 ? undefined : ArrowRight}
              isDisabled={finish.isPending}
              onPress={() => {
                if (step < STEPS.length - 1) setStep((current) => current + 1);
                else void complete();
              }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Split out so the keyboard-aware input doesn't re-render the whole flow. */
function NameField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <Input
      placeholder="Your name"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="words"
      autoComplete="name"
      accessibilityLabel="Your name"
    />
  );
}

/** Split out so the keyboard-aware input doesn't re-render the whole flow. */
function AccountNameField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <Input
      placeholder="HDFC Millennia, Cash, …"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="words"
      accessibilityLabel="Account name"
    />
  );
}
