/**
 * A lock for async code.
 */
export default class Lock {
  private queue: ((value?: void) => void)[];
  private locked: boolean;

  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async acquire() {
    if (this.locked) {
      await new Promise(resolve => { this.queue.push(resolve); });
    }
    this.locked = true;
  }

  release() {
    if (!this.locked) {
      throw new Error('The lock must be acquired before release');
    }
    this.locked = false;
    if (this.queue.length) {
      const resolve = this.queue.shift()!;
      resolve();
    }
  }

  async execute(asyncFunc: () => Promise<void>) {
    await this.acquire();
    try {
      return await asyncFunc();
    } finally {
      this.release();
    }
  }
}
