import { StorageWrapper } from "../../util/storage-wrapper";
import { Api } from "../cf-api";

/**
 * Wrapper for all useful contest data.
 */
export class Contest {
  contest: any;
  problems: number;
  rows: any[];
  ratingChanges: any[]
  oldRatings: Map<string, number>;
  performances: Map<string, number> | null;
  fetchTime: number;
  isRated: string;
  startTimeSeconds: number;
  durationSeconds: number;

  constructor(
    contest: any,
    problems: number,
    rows: any[],
    ratingChanges: any[],
    oldRatings: Map<string, number>,
    fetchTime: number,
    isRated: string,
  ) {
    this.contest = contest;
    this.problems = problems;
    this.rows = rows;
    this.ratingChanges = ratingChanges; // undefined if isRated is not YES
    this.oldRatings = oldRatings; // undefined if isRated is not YES
    this.fetchTime = fetchTime;
    this.isRated = isRated;
    this.performances = null;  // To be populated by someone who calculates the performances.
    this.startTimeSeconds = 0;
    this.durationSeconds = 0;
  }

  static IsRated = {
    YES: 'YES',
    NO: 'NO',
    LIKELY: 'LIKELY',
  };

  toPlainObject() {
    return {
      contest: this.contest,
      problems: this.problems,
      rows: this.rows,
      ratingChanges: this.ratingChanges,
      oldRatings: Array.from(this.oldRatings),
      fetchTime: this.fetchTime,
      isRated: this.isRated,
    };
  }

  static fromPlainObject(obj: any) {
    const c = new Contest(
      obj.contest,
      obj.problems,
      obj.rows,
      obj.ratingChanges,
      new Map(obj.oldRatings),
      obj.fetchTime,
      obj.isRated,
    );
    return c;
  }
}

const MAGIC_CACHE_DURATION = 5 * 60 * 1000; // 5 mins
const RATING_PENDING_MAX_DAYS = 3;

function isOldContest(contest: Contest) {
  const daysSinceContestEnd =
    (Date.now() / 1000 - contest.startTimeSeconds - contest.durationSeconds) / (60 * 60 * 24);
  return daysSinceContestEnd > RATING_PENDING_MAX_DAYS;
}

function isMagicOn() {
  let now = new Date();
  // Assume Codeforces Magic lasts from 24 Dec to 11 Jan.
  // https://codeforces.com/blog/entry/110477
  return now.getMonth() === 11 && now.getDate() >= 24
    || now.getMonth() === 0 && now.getDate() <= 11;
}

const MAX_FINISHED_CONTESTS_TO_CACHE = 5;

const CONTESTS_COMPLETE = 'cache.contests_complete';
const CONTESTS_COMPLETE_IDS = 'cache.contests_complete.ids';
const CONTESTS_COMPLETE_TIMESTAMP = 'cache.contests_complete.timestamp';

/**
 * Fetches complete contest information from the API. Caches finished contests in memory.
 */
export class ContestsComplete {
  api: Api;
  storage: StorageWrapper;

  constructor(api: Api, storage: StorageWrapper) {
    this.api = api;
    this.storage = storage;
  }

  async getContests() {
    let res = await this.storage.get(CONTESTS_COMPLETE, {});
    // convert object to map
    res = new Map(Object.entries(res).map(([k, v]) => [parseInt(k), Contest.fromPlainObject(v)]));
    return res;
  }

  async setContests(contests: Map<number, Contest>) {
    const obj = Object.fromEntries([...contests.entries()].map(([k, v]) => [k, v.toPlainObject()]));
    await this.storage.set(CONTESTS_COMPLETE, obj);
  }

  async getContestIds() {
    return await this.storage.get(CONTESTS_COMPLETE_IDS, []);
  }

  async setContestIds(contestIds: number[]) {
    await this.storage.set(CONTESTS_COMPLETE_IDS, contestIds);
  }

  async getContestTimestamp() {
    let res = await this.storage.get(CONTESTS_COMPLETE_TIMESTAMP, {});
    res = new Map(Object.entries(res));
    return res;
  }

  async setContestTimestamp(contestTimestamp: Map<number, number>) {
    const obj = Object.fromEntries(contestTimestamp);
    await this.storage.set(CONTESTS_COMPLETE_TIMESTAMP, obj);
  }

  async fetch(contestId: number): Promise<Contest> {
    const cachedContests = await this.getContests();
    if (cachedContests.has(contestId)) {
      console.log('Returning cached contest');
      return cachedContests.get(contestId)!;
    }

    const { contest, problems, rows } = await this.api.contestStandings(contestId);
    let ratingChanges;
    let oldRatings: Map<string, number>;
    let isRated = Contest.IsRated.LIKELY;
    if (contest.phase === 'FINISHED') {
      try {
        ratingChanges = await this.api.contestRatingChanges(contestId);
        if (ratingChanges) {
          if (ratingChanges.length > 0) {
            isRated = Contest.IsRated.YES;
            oldRatings = adjustOldRatings(contestId, ratingChanges);
          } else {
            ratingChanges = undefined; // Reset to undefined if it was an empty array
          }
        }
      } catch (er: any) {
        if (er.message.includes('Rating changes are unavailable for this contest')) {
          isRated = Contest.IsRated.NO;
        }
      }
    }
    if (isRated === Contest.IsRated.LIKELY && isOldContest(contest)) {
      isRated = Contest.IsRated.NO;
    }
    const isFinished = isRated === Contest.IsRated.NO || isRated === Contest.IsRated.YES;

    const c = new Contest(contest, problems, rows, ratingChanges, oldRatings!, Date.now(), isRated);

    // If the contest is finished, the contest data doesn't change so cache it.
    // The exception is during new year's magic, when people change handles and handles on the
    // ranklist can become outdated. So cache it only for a small duration.
    // TODO: New users can also change handles upto a week(?) after joining. Is this a big enough
    // issue to stop caching completely?
    if (isFinished) {
      const contests = await this.getContests();
      contests.set(contestId, c);
      let contestIds = await this.getContestIds();
      contestIds.push(contestId);
      while (contestIds.length > MAX_FINISHED_CONTESTS_TO_CACHE) {
        contests.delete(contestIds.shift()!);
      }
      if (isMagicOn()) {
        const contestTimestamp = await this.getContestTimestamp();
        // delete outdated timestamp and contest and contestId
        for (const [cid, timestamp] of contestTimestamp) {
          if (Date.now() - timestamp > MAGIC_CACHE_DURATION) {
            contestTimestamp.delete(cid);
            contests.delete(cid);
            contestIds = contestIds.filter((c: number) => c !== cid);
          }
        }
        contestTimestamp.set(contestId, Date.now());
        await this.setContestTimestamp(contestTimestamp);
      }
      await this.setContests(contests);
      await this.setContestIds(contestIds);
    }

    return c;
  }
}

const FAKE_RATINGS_SINCE_CONTEST = 1360;
const NEW_DEFAULT_RATING = 1400;

function adjustOldRatings(contestId: number, ratingChanges: any) {
  const oldRatings = new Map();
  if (contestId < FAKE_RATINGS_SINCE_CONTEST) {
    for (const change of ratingChanges) {
      oldRatings.set(change.handle, change.oldRating);
    }
  } else {
    for (const change of ratingChanges) {
      oldRatings.set(change.handle, change.oldRating == 0 ? NEW_DEFAULT_RATING : change.oldRating);
    }
    // Note: This a band-aid for CF's fake ratings (see Github #18).
    // If CF tells us that a user had rating 0, we consider that the user is in fact unrated.
    // This unfortunately means that a user who truly has rating 0 will be considered to have
    // DEFAULT_RATING, but such cases are unlikely compared to the regular presence of unrated
    // users.
  }
  return oldRatings;
}
