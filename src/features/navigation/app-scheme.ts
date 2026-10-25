import Constants from 'expo-constants';

import { pickScheme } from '@/domain/deep-link';

/** The link scheme of the build that is running: `finly`, or `finly-dev` in the development build. */
export const appScheme = (): string => pickScheme(Constants.expoConfig?.scheme);
