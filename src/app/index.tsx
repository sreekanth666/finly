import { Button, Chip, Separator, Surface, Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppColor } from '@/theme';

/**
 * Theme preview.
 *
 * A scratch screen that exercises the Zenith tokens end to end — every color
 * here comes from `src/theme/tokens.css`, nothing is inlined. Delete it once the
 * real screens land.
 */
export default function ThemePreviewScreen() {
  // Same tokens the styles above use, resolved through JS — proves both paths
  // read the one source of truth in src/theme/tokens.css.
  const [background, surface, accent, iris, income] = useAppColor([
    'background',
    'surface',
    'accent',
    'iris',
    'income',
  ]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-8 px-5 pb-16 pt-2">
        <View className="gap-1">
          <Typography type="h2">Zenith</Typography>
          <Typography type="body-sm" color="muted">
            Design tokens preview
          </Typography>
        </View>

        <Section title="Filters">
          <View className="flex-row flex-wrap gap-2">
            <Chip color="accent">
              <Chip.Label>All</Chip.Label>
            </Chip>
            <Chip color="default" variant="secondary">
              <Chip.Label>Income</Chip.Label>
            </Chip>
            <Chip color="default" variant="secondary">
              <Chip.Label>Shopping</Chip.Label>
            </Chip>
            <Chip color="default" variant="secondary">
              <Chip.Label>Bills</Chip.Label>
            </Chip>
          </View>
        </Section>

        <Section title="Stat cards">
          <View className="flex-row gap-3">
            <StatCard
              className="bg-iris"
              labelClassName="text-iris-foreground"
              label="Upcoming bills"
              caption="in 7 days"
              amount="$1,280.29"
            />
            <StatCard
              className="bg-accent"
              labelClassName="text-accent-foreground"
              label="Auto Savings"
              caption="53% of goal"
              amount="$326.04"
            />
          </View>
        </Section>

        <Section title="Transactions">
          <Surface className="gap-3 rounded-3xl p-4">
            <TransactionRow
              title="Groceries"
              category="Shopping"
              amount="-$25.20"
              amountClassName="text-expense"
              time="11:23"
            />
            <Separator />
            <TransactionRow
              title="Freelance Project"
              category="Income"
              amount="+$350.00"
              amountClassName="text-income"
              time="09:07"
            />
            <Separator />
            <TransactionRow
              title="Electricity Bill"
              category="Bills"
              amount="-$45.60"
              amountClassName="text-expense"
              time="18:43"
            />
          </Surface>
        </Section>

        <Section title="Buttons">
          <View className="gap-3">
            <Button variant="primary">
              <Button.Label>Get Started!</Button.Label>
            </Button>
            <View className="flex-row gap-3">
              <Button variant="secondary" className="flex-1">
                <Button.Label>Secondary</Button.Label>
              </Button>
              <Button variant="tertiary" className="flex-1">
                <Button.Label>Tertiary</Button.Label>
              </Button>
            </View>
            <View className="flex-row gap-3">
              <Button variant="ghost" className="flex-1">
                <Button.Label>Ghost</Button.Label>
              </Button>
              <Button variant="danger" className="flex-1">
                <Button.Label>Danger</Button.Label>
              </Button>
            </View>
          </View>
        </Section>

        <Section title="Surfaces">
          <View className="flex-row gap-3">
            <Surface variant="default" className="flex-1 items-center rounded-2xl py-5">
              <Typography type="body-xs" color="muted">
                default
              </Typography>
            </Surface>
            <Surface variant="secondary" className="flex-1 items-center rounded-2xl py-5">
              <Typography type="body-xs" color="muted">
                secondary
              </Typography>
            </Surface>
            <Surface variant="tertiary" className="flex-1 items-center rounded-2xl py-5">
              <Typography type="body-xs" color="muted">
                tertiary
              </Typography>
            </Surface>
          </View>
        </Section>

        <Section title="Palette">
          <View className="flex-row flex-wrap gap-2">
            <Swatch name="background" className="bg-background" />
            <Swatch name="surface" className="bg-surface" />
            <Swatch name="surface-secondary" className="bg-surface-secondary" />
            <Swatch name="surface-tertiary" className="bg-surface-tertiary" />
            <Swatch name="accent" className="bg-accent" />
            <Swatch name="accent-soft" className="bg-accent-soft" />
            <Swatch name="iris" className="bg-iris" />
            <Swatch name="income" className="bg-income" />
            <Swatch name="success" className="bg-success" />
            <Swatch name="warning" className="bg-warning" />
            <Swatch name="danger" className="bg-danger" />
            <Swatch name="default" className="bg-default" />
            <Swatch name="field" className="bg-field" />
            <Swatch name="border" className="bg-border" />
            <Swatch name="muted" className="bg-muted" />
            <Swatch name="foreground" className="bg-foreground" />
          </View>
        </Section>

        <Section title="Resolved in JS">
          <Surface variant="secondary" className="gap-2 rounded-2xl p-4">
            <ResolvedRow name="background" value={background} />
            <ResolvedRow name="surface" value={surface} />
            <ResolvedRow name="accent" value={accent} />
            <ResolvedRow name="iris" value={iris} />
            <ResolvedRow name="income" value={income} />
          </Surface>
        </Section>

        <Section title="Text">
          <View className="gap-1">
            <Typography type="body">Primary foreground</Typography>
            <Typography type="body" color="muted">
              Muted foreground
            </Typography>
            <Typography type="body" className="text-accent">
              Accent
            </Typography>
            <Typography type="body" className="text-link">
              See more
            </Typography>
            <Typography type="body" className="text-income">
              +$2,650.00
            </Typography>
            <Typography type="body" className="text-danger">
              Payment failed
            </Typography>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResolvedRow({ name, value }: { name: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Typography type="body-xs" color="muted">
        {name}
      </Typography>
      <Typography type="code">{value}</Typography>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Typography type="body-xs" color="muted" weight="semibold" className="uppercase">
        {title}
      </Typography>
      {children}
    </View>
  );
}

function StatCard({
  className,
  labelClassName,
  label,
  caption,
  amount,
}: {
  className: string;
  labelClassName: string;
  label: string;
  caption: string;
  amount: string;
}) {
  return (
    <View className={`flex-1 justify-between gap-8 rounded-3xl p-4 ${className}`}>
      <Typography type="body" weight="semibold" className={labelClassName}>
        {label}
      </Typography>
      <View className="gap-1">
        <Typography type="body-xs" className={labelClassName}>
          {caption}
        </Typography>
        <Typography type="h4" weight="bold" className={labelClassName}>
          {amount}
        </Typography>
      </View>
    </View>
  );
}

function TransactionRow({
  title,
  category,
  amount,
  amountClassName,
  time,
}: {
  title: string;
  category: string;
  amount: string;
  amountClassName: string;
  time: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="size-10 rounded-2xl bg-surface-tertiary" />
      <View className="flex-1 gap-0.5">
        <Typography type="body" weight="medium">
          {title}
        </Typography>
        <Typography type="body-xs" color="muted">
          {category}
        </Typography>
      </View>
      <View className="items-end gap-0.5">
        <Typography type="body" weight="semibold" className={amountClassName}>
          {amount}
        </Typography>
        <Typography type="body-xs" color="muted">
          {time}
        </Typography>
      </View>
    </View>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <View className="w-[31%] gap-1">
      <View className={`h-12 rounded-xl border border-border ${className}`} />
      <Typography type="body-xs" color="muted">
        {name}
      </Typography>
    </View>
  );
}
