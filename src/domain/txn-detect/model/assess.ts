/**
 * The model's second opinion on one payment the rules read (D21).
 *
 * The result is the global score and the key the user's labels count under;
 * their labels and the threshold are applied where the inbox is read
 * (`doubt.ts`), so a new label takes effect without reading anything again.
 */

import type { Detection, MessageInput } from '../types';
import { featuresOf } from './features';
import { isAssessable, labelKeyOf, modelInputOf } from './scope';
import file from './weights.json';
import { decodeModel, scoreOf, type Model, type ModelFile } from './weights-format';

export { isAssessable, labelKeyOf, modelInputOf } from './scope';

export const MODEL_VERSION: number = (file as ModelFile).version;

let cached: Model | null = null;

/** The shipped model, decoded on first use. */
export function shippedModel(): Model {
  cached ??= decodeModel(file as ModelFile);
  return cached;
}

export type Assessment = { score: number; key: string | null; version: number };

export function assess(input: MessageInput, detection: Detection, model: Model = shippedModel()): Assessment | null {
  if (!isAssessable(detection)) return null;
  return {
    score: scoreOf(model, featuresOf(modelInputOf(input), model.buckets)),
    key: labelKeyOf(input),
    version: model.version,
  };
}
