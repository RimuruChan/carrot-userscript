import { SYNC } from './storage-wrapper';

/**
 * Exports utility functions to get or set user preferences to storage.
 */

function boolSetterGetter(key: string, defaultValue: boolean) {
  return async (value?: boolean) => {
    if (value === undefined) {
      return await SYNC.get(key, defaultValue);
    }
    return await SYNC.set(key, value);
  };
}

export const enablePredictDeltas = boolSetterGetter('settings.enablePredictDeltas', true);
export const enableFinalDeltas = boolSetterGetter('settings.enableFetchDeltas', true);
export const enablePrefetchRatings = boolSetterGetter('settings.enablePrefetchRatings', true);
export const showColCurrentPerformance = boolSetterGetter('settings.showColCurrentPerformance', true);
export const showColPredictedDelta = boolSetterGetter('settings.showColPredictedDelta', true);
export const showColRankUpDelta = boolSetterGetter('settings.showColRankUpDelta', true);
export const showColFinalPerformance = boolSetterGetter('settings.showColFinalPerformance', true);
export const showColFinalDelta = boolSetterGetter('settings.showColFinalDelta', true);
export const showColRankChange = boolSetterGetter('settings.showColRankChange', true);

export interface Prefs {
  enablePredictDeltas: boolean;
  enableFinalDeltas: boolean;
  enablePrefetchRatings: boolean;
  showColCurrentPerformance: boolean;
  showColPredictedDelta: boolean;
  showColRankUpDelta: boolean;
  showColFinalPerformance: boolean;
  showColFinalDelta: boolean;
  showColRankChange: boolean;
}

export async function getPrefs(): Promise<Prefs> {
  return {
    enablePredictDeltas: await enablePredictDeltas(),
    enableFinalDeltas: await enableFinalDeltas(),
    enablePrefetchRatings: await enablePrefetchRatings(),
    showColCurrentPerformance: await showColCurrentPerformance(),
    showColPredictedDelta: await showColPredictedDelta(),
    showColRankUpDelta: await showColRankUpDelta(),
    showColFinalPerformance: await showColFinalPerformance(),
    showColFinalDelta: await showColFinalDelta(),
    showColRankChange: await showColRankChange(),
  }
}
