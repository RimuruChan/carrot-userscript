import Lock from '../../util/lock';
import { StorageWrapper } from '../../util/storage-wrapper';
import { Api } from '../cf-api';

const REFRESH_INTERVAL = 6 * 60 * 60 * 1000;  // 6 hours

const CONTESTS = 'cache.contests';
const CONTESTS_TIMESTAMP = 'cache.contests.timestamp';

export default class Contests {
  api: Api;
  storage: StorageWrapper;
  lock: Lock;

  constructor(api: Api, storage: StorageWrapper) {
    this.api = api;
    this.storage = storage;
    this.lock = new Lock();
  }

  async getLastAttemptTime() {
    return await this.storage.get(CONTESTS_TIMESTAMP, 0);
  }

  async setLastAttemptTime(time: number) {
    await this.storage.set(CONTESTS_TIMESTAMP, time);
  }

  async getContestMap() {
    let res = await this.storage.get(CONTESTS, {});
    // convert object to map
    res = new Map(Object.entries(res).map(([k, v]) => [parseInt(k), v]));
    return res;
  }

  async setContestMap(contestMap: Map<number, any>) {
    // convert map to plain object
    const obj = Object.fromEntries(contestMap);
    await this.storage.set(CONTESTS, obj);
  }

  async maybeRefreshCache() {
    const inner = async () => {
      const now = Date.now();
      const refresh = now - await this.getLastAttemptTime() > REFRESH_INTERVAL;
      if (!refresh) {
        return;
      }
      await this.setLastAttemptTime(now);
      try {
        const contests = await this.api.contestList();
        await this.setContestMap(new Map(contests.map((c: any) => [c.id, c])));
      } catch (er) {
        console.warn('Unable to fetch contest list: ' + er);
      }
    };

    // Not that heavy so simultaneous queries aren't a terrible thing to do, but lock anyway.
    await this.lock.execute(inner);
  }

  async list(): Promise<any[]> {
    // return Array.from(this.contestMap.values());
    return Array.from((await this.getContestMap()).values());
  }

  async hasCached(contestId: number) {
    return (await this.getContestMap()).has(contestId);
  }

  async getCached(contestId: number) {
    return (await this.getContestMap()).get(contestId);
  }

  async update(contest: any) {
    const contestMap = await this.getContestMap();
    contestMap.set(contest.id, contest);
    await this.setContestMap(contestMap);
  }
}
