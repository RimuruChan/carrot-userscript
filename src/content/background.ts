import { Api } from './cf-api';
import predict, { Contestant, PredictResult } from './predict';
import PredictResponse from './predict-response';
import Contests from './cache/contests';
import Ratings from './cache/ratings';
import { Contest, ContestsComplete } from './cache/contests-complete';
import { LOCAL } from '../util/storage-wrapper';
import { getPrefs, Prefs } from '../util/settings';

const DEBUG_FORCE_PREDICT = false;

const UNRATED_HINTS = ['unrated', 'fools', 'q#', 'kotlin', 'marathon', 'teams'];
const EDU_ROUND_RATED_THRESHOLD = 2100;

const API = new Api(fetchFromContentScript);
const CONTESTS = new Contests(API, LOCAL);
const RATINGS = new Ratings(API, LOCAL);
const CONTESTS_COMPLETE = new ContestsComplete(API, LOCAL);

const API_PATH = '/api/';

async function fetchFromContentScript(path: string, queryParamList: [string, string][]): Promise<any> {
  const url = new URL(location.origin + API_PATH + path);
  for (const [key, value] of queryParamList) {
    url.searchParams.append(key, value);
  }
  const resp = await fetch(url);
  const text = await resp.text();
  if (resp.status !== 200) {
    throw new Error(`CF API: HTTP error ${resp.status}: ${text}`)
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    throw new Error(`CF API: Invalid JSON: ${text}`);
  }
  if (json.status !== 'OK' || json.result === undefined) {
    throw new Error(`CF API: Error: ${text}`);
  }
  return json.result;
}

/* ----------------------------------------------- */
/*   Prediction                                    */
/* ----------------------------------------------- */

function isUnratedByName(contestName: string) {
  const lower = contestName.toLowerCase();
  return UNRATED_HINTS.some((hint) => lower.includes(hint));
}

function anyRowHasTeam(rows: any[]) {
  return rows.some((row) => row.party.teamId != null || row.party.teamName != null)
}

async function getDeltas(contestId: number) {
  const prefs = await getPrefs();
  return await calcDeltas(contestId, prefs);
}

async function calcDeltas(contestId: number, prefs: Prefs) {
  if (!prefs.enablePredictDeltas && !prefs.enableFinalDeltas) {
    return { result: 'DISABLED' };
  }

  if (await CONTESTS.hasCached(contestId)) {
    const contest = await CONTESTS.getCached(contestId);
    if (isUnratedByName(contest.name)) {
      return { result: 'UNRATED_CONTEST' };
    }
  }

  const contest = await CONTESTS_COMPLETE.fetch(contestId);
  CONTESTS.update(contest.contest);

  if (contest.isRated === Contest.IsRated.NO) {
    return { result: 'UNRATED_CONTEST' };
  }

  if (!DEBUG_FORCE_PREDICT && contest.isRated === Contest.IsRated.YES) {
    if (!prefs.enableFinalDeltas) {
      return { result: 'DISABLED' };
    }
    return {
      result: 'OK',
      prefs,
      predictResponse: getFinal(contest),
    };
  }

  // Now contest.isRated = LIKELY
  if (isUnratedByName(contest.contest.name)) {
    return { result: 'UNRATED_CONTEST' };
  }
  if (anyRowHasTeam(contest.rows)) {
    return { result: 'UNRATED_CONTEST' };
  }
  if (!prefs.enablePredictDeltas) {
    return { result: 'DISABLED' };
  }
  return {
    result: 'OK',
    prefs,
    predictResponse: await getPredicted(contest),
  };
}

function predictForRows(rows: any[], ratingBeforeContest: Map<string, number>) {
  const contestants = rows.map((row) => {
    const handle = row.party.members[0].handle;
    return new Contestant(handle, row.points, row.penalty, ratingBeforeContest.get(handle) ?? null);
  });
  return predict(contestants, true);
}

function getFinal(contest: Contest) {
  // Calculate and save the performances on the contest object if not already saved.
  if (contest.performances === null) {
    const ratingBeforeContest = new Map(
      contest.ratingChanges.map((c: any) => [c.handle as string, contest.oldRatings.get(c.handle) as number]));
    const rows = contest.rows.filter((row: any) => {
      const handle = row.party.members[0].handle;
      return ratingBeforeContest.has(handle);
    });
    const predictResultsForPerf = predictForRows(rows, ratingBeforeContest);
    contest.performances = new Map(predictResultsForPerf.map((r) => [r.handle, r.performance!]));
  }

  const predictResults = [];
  for (const change of contest.ratingChanges) {
    predictResults.push(
      new PredictResult(
        change.handle, change.oldRating, change.newRating - change.oldRating,
        contest.performances!.get(change.handle)!));
  }
  return new PredictResponse(predictResults, PredictResponse.TYPE_FINAL, contest.fetchTime);
}

async function getPredicted(contest: Contest) {
  const ratingMap = await RATINGS.fetchCurrentRatings(contest.contest.startTimeSeconds * 1000);
  const isEduRound = contest.contest.name.toLowerCase().includes('educational');
  let rows = contest.rows;
  if (isEduRound) {
    // For educational rounds, standings include contestants for whom the contest is not rated.
    rows = contest.rows.filter((row) => {
      const handle = row.party.members[0].handle;
      // Rated if the user is unrated or has rating below EDU_ROUND_RATED_THRESHOLD
      return !ratingMap.has(handle) || ratingMap.get(handle)! < EDU_ROUND_RATED_THRESHOLD;
    });
  }
  const predictResults = predictForRows(rows, ratingMap);
  return new PredictResponse(predictResults, PredictResponse.TYPE_PREDICTED, contest.fetchTime);
}

/* ----------------------------------------------- */
/*   Cache and API stuff                           */
/* ----------------------------------------------- */


export async function predictDeltas(contestId: number): Promise<any> {
  return await getDeltas(contestId);
}

export async function maybeUpdateContestList() {
  const prefs = await getPrefs();
  if (!prefs.enablePredictDeltas && !prefs.enableFinalDeltas) {
    return;
  }
  await CONTESTS.maybeRefreshCache();
}

async function getNearestUpcomingRatedContestStartTime() {
  let nearest = null;
  const now = Date.now();
  for (const c of await CONTESTS.list()) {
    const start = (c.startTimeSeconds || 0) * 1000;
    if (start < now || isUnratedByName(c.name)) {
      continue;
    }
    if (nearest === null || start < nearest) {
      nearest = start;
    }
  }
  return nearest;
}

export async function maybeUpdateRatings() {
  const prefs = await getPrefs();
  if (!prefs.enablePredictDeltas || !prefs.enablePrefetchRatings) {
    return;
  }
  const startTimeMs = await getNearestUpcomingRatedContestStartTime();
  if (startTimeMs !== null) {
    await RATINGS.maybeRefreshCache(startTimeMs);
  }
}
