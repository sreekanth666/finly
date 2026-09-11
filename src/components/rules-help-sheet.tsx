import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Typography } from 'heroui-native';
import { View } from 'react-native';

import { Button } from './button';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

export type RulesHelpSheetProps = {
  isOpen: boolean;
  onOpenChange: (next: boolean) => void;
};

/*
 * Every sentence here describes behaviour that exists — in `domain/rules.ts`
 * and in how ExpenseForm applies a match — and nothing more. In particular it
 * says nothing about which of two equal-priority rules wins, because nothing
 * decides that: they come back in whatever order SQLite returns them. If the
 * engine changes, this copy has to change with it.
 */
const SECTIONS: readonly { title: string; lines: readonly string[] }[] = [
  {
    title: 'What a rule does',
    lines: [
      'While you add an expense, Finly checks your rules against what you type in Item and Note.',
      'A matching rule fills in the category, the account, and whether the expense counts toward your budget — whichever of those it sets.',
    ],
  },
  {
    title: 'How a match is found',
    lines: [
      'Each condition looks at Item or Note and asks whether it contains, is, or starts with some text. Case and spaces at either end are ignored.',
      '“Match all” needs every condition to hold. “Match any” needs just one.',
    ],
  },
  {
    title: 'Which rule wins',
    lines: [
      'Rules are checked from the highest priority down, and the first one that matches is the only one that applies — two rules never combine.',
      'Paused rules are skipped entirely.',
    ],
  },
  {
    title: 'You stay in charge',
    lines: [
      'A rule only fills fields you haven’t touched yourself. Anything it filled is marked “From rule”, and changing it overrides the rule.',
      'Rules never rewrite expenses you’ve already saved, and they aren’t applied to a CSV import.',
    ],
  },
  {
    title: 'Getting the most out of them',
    lines: [
      'Not sure where to start? Open a template from the Rules tab — each is a finished rule for a common spend, with a note on why it’s built that way.',
      'Use “starts with” for a merchant name and “contains” for a keyword that shows up anywhere.',
      'Put a specific rule above a general one: “Swiggy Instamart” → Groceries at 80 catches those before “Swiggy” → Food at 50 sees them.',
      'Give overlapping rules different priorities — two at the same number have no guaranteed order.',
      'Pause a rule you’re unsure about instead of deleting it.',
      'Check a new rule with the match preview in the editor, and watch “Used N times” on each card to see which rules earn their place.',
    ],
  },
];

/**
 * How rules work, from the "?" in the Rules header.
 *
 * Controlled from the screen and mounted for its whole life, for the reason
 * TransactionFilters gives: a sheet mounted on the same press that opens it
 * has not been laid out yet, gorhom drops the snap, and the first tap opens
 * nothing.
 */
export function RulesHelpSheet({ isOpen, onOpenChange }: RulesHelpSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        {/* Pinned height and a bounded content container, as in
            TransactionFilters: dynamic sizing mounts the sheet part-way up
            before it has measured, and without the bound the scroll view
            cannot scroll past the snap point. */}
        <BottomSheet.Content
          snapPoints={['85%']}
          enableDynamicSizing={false}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          contentContainerClassName="h-full">
          <BottomSheetScrollView>
            <View className="gap-5 pb-8">
              <BottomSheet.Title>How rules work</BottomSheet.Title>

              {SECTIONS.map((section) => (
                <View key={section.title} className="gap-1.5">
                  <Typography type="body-sm" weight="semibold">
                    {section.title}
                  </Typography>
                  {section.lines.map((line) => (
                    <Typography key={line} type="body-sm" color="muted">
                      {line}
                    </Typography>
                  ))}
                </View>
              ))}

              <Button label="Got it" onPress={() => onOpenChange(false)} />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
