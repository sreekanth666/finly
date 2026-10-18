/**
 * Every Lucide icon the app uses, imported one file at a time.
 *
 * `lucide-react-native`'s barrel re-exports ~1,800 icons and Metro does not
 * tree-shake it, so `import { Mail } from 'lucide-react-native'` bundles the
 * whole set. Importing from the package's per-icon entry pulls in only that
 * icon. Screens import from here, never from the package itself — an ESLint
 * rule enforces it — so a new icon is a new line in this file.
 *
 * A few names are aliases in Lucide whose file is named differently
 * (`CircleHelp` is circle-question-mark, `FileJson` is file-braces,
 * `Fingerprint` is fingerprint-pattern); when a kebab-cased path does not
 * exist, look the name up in the package's own barrel under node_modules. The
 * type export is free: it is erased at build time.
 */

export type { LucideIcon } from 'lucide-react-native';

export { default as Archive } from 'lucide-react-native/icons/archive';
export { default as ArrowDownLeft } from 'lucide-react-native/icons/arrow-down-left';
export { default as ArrowDownUp } from 'lucide-react-native/icons/arrow-down-up';
export { default as ArrowLeft } from 'lucide-react-native/icons/arrow-left';
export { default as ArrowRight } from 'lucide-react-native/icons/arrow-right';
export { default as Ban } from 'lucide-react-native/icons/ban';
export { default as Banknote } from 'lucide-react-native/icons/banknote';
export { default as BatteryWarning } from 'lucide-react-native/icons/battery-warning';
export { default as BellOff } from 'lucide-react-native/icons/bell-off';
export { default as BellRing } from 'lucide-react-native/icons/bell-ring';
export { default as BookOpenText } from 'lucide-react-native/icons/book-open-text';
export { default as Car } from 'lucide-react-native/icons/car';
export { default as ChartPie } from 'lucide-react-native/icons/chart-pie';
export { default as Check } from 'lucide-react-native/icons/check';
export { default as ChevronDown } from 'lucide-react-native/icons/chevron-down';
export { default as ChevronLeft } from 'lucide-react-native/icons/chevron-left';
export { default as ChevronRight } from 'lucide-react-native/icons/chevron-right';
export { default as ChevronUp } from 'lucide-react-native/icons/chevron-up';
export { default as Circle } from 'lucide-react-native/icons/circle';
export { default as CircleAlert } from 'lucide-react-native/icons/circle-alert';
export { default as CircleCheck } from 'lucide-react-native/icons/circle-check';
export { default as CircleDollarSign } from 'lucide-react-native/icons/circle-dollar-sign';
export { default as CircleHelp } from 'lucide-react-native/icons/circle-question-mark';
export { default as CircleQuestionMark } from 'lucide-react-native/icons/circle-question-mark';
export { default as CircleSlash2 } from 'lucide-react-native/icons/circle-slash-2';
export { default as ClipboardPaste } from 'lucide-react-native/icons/clipboard-paste';
export { default as Clock } from 'lucide-react-native/icons/clock';
export { default as Coins } from 'lucide-react-native/icons/coins';
export { default as Compass } from 'lucide-react-native/icons/compass';
export { default as CreditCard } from 'lucide-react-native/icons/credit-card';
export { default as DatabaseBackup } from 'lucide-react-native/icons/database-backup';
export { default as Ellipsis } from 'lucide-react-native/icons/ellipsis';
export { default as EllipsisVertical } from 'lucide-react-native/icons/ellipsis-vertical';
export { default as Eye } from 'lucide-react-native/icons/eye';
export { default as EyeOff } from 'lucide-react-native/icons/eye-off';
export { default as FileJson } from 'lucide-react-native/icons/file-braces';
export { default as FileSpreadsheet } from 'lucide-react-native/icons/file-spreadsheet';
export { default as Fingerprint } from 'lucide-react-native/icons/fingerprint-pattern';
export { default as Gift } from 'lucide-react-native/icons/gift';
export { default as GraduationCap } from 'lucide-react-native/icons/graduation-cap';
export { default as HardDrive } from 'lucide-react-native/icons/hard-drive';
export { default as HeartPulse } from 'lucide-react-native/icons/heart-pulse';
export { default as House } from 'lucide-react-native/icons/house';
export { default as Inbox } from 'lucide-react-native/icons/inbox';
export { default as Info } from 'lucide-react-native/icons/info';
export { default as KeyRound } from 'lucide-react-native/icons/key-round';
export { default as Landmark } from 'lucide-react-native/icons/landmark';
export { default as LayoutTemplate } from 'lucide-react-native/icons/layout-template';
export { default as Lightbulb } from 'lucide-react-native/icons/lightbulb';
export { default as Link2 } from 'lucide-react-native/icons/link-2';
export { default as ListChecks } from 'lucide-react-native/icons/list-checks';
export { default as Lock } from 'lucide-react-native/icons/lock';
export { default as Mail } from 'lucide-react-native/icons/mail';
export { default as MessageSquareText } from 'lucide-react-native/icons/message-square-text';
export { default as Minus } from 'lucide-react-native/icons/minus';
export { default as PawPrint } from 'lucide-react-native/icons/paw-print';
export { default as Plane } from 'lucide-react-native/icons/plane';
export { default as Plus } from 'lucide-react-native/icons/plus';
export { default as Popcorn } from 'lucide-react-native/icons/popcorn';
export { default as Receipt } from 'lucide-react-native/icons/receipt';
export { default as Repeat } from 'lucide-react-native/icons/repeat';
export { default as RotateCcw } from 'lucide-react-native/icons/rotate-ccw';
export { default as RotateCw } from 'lucide-react-native/icons/rotate-cw';
export { default as Search } from 'lucide-react-native/icons/search';
export { default as Settings } from 'lucide-react-native/icons/settings';
export { default as Settings2 } from 'lucide-react-native/icons/settings-2';
export { default as Shapes } from 'lucide-react-native/icons/shapes';
export { default as Share2 } from 'lucide-react-native/icons/share-2';
export { default as ShieldAlert } from 'lucide-react-native/icons/shield-alert';
export { default as ShieldCheck } from 'lucide-react-native/icons/shield-check';
export { default as ShoppingBag } from 'lucide-react-native/icons/shopping-bag';
export { default as ShoppingBasket } from 'lucide-react-native/icons/shopping-basket';
export { default as SlidersHorizontal } from 'lucide-react-native/icons/sliders-horizontal';
export { default as Smartphone } from 'lucide-react-native/icons/smartphone';
export { default as Sparkle } from 'lucide-react-native/icons/sparkle';
export { default as Sparkles } from 'lucide-react-native/icons/sparkles';
export { default as Trash2 } from 'lucide-react-native/icons/trash-2';
export { default as TriangleAlert } from 'lucide-react-native/icons/triangle-alert';
export { default as Undo2 } from 'lucide-react-native/icons/undo-2';
export { default as Upload } from 'lucide-react-native/icons/upload';
export { default as User } from 'lucide-react-native/icons/user';
export { default as UtensilsCrossed } from 'lucide-react-native/icons/utensils-crossed';
export { default as Wallet } from 'lucide-react-native/icons/wallet';
export { default as Wrench } from 'lucide-react-native/icons/wrench';
export { default as X } from 'lucide-react-native/icons/x';
