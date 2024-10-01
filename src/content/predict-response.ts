import { Rank } from './rank';

class PredictResponseRow {
  delta: number;
  rank: Rank;
  performance: { value: string, colorClass: string };

  // For FINAL
  newRank: Rank | null;

  // For PREDICTED
  deltaReqForRankUp: number | null;
  nextRank: Rank | null;

  constructor(
    delta: number,
    rank: Rank,
    performance: { value: string, colorClass: string },
    newRank: Rank | null,
    deltaReqForRankUp: number | null,
    nextRank: Rank | null
  ) {
    this.delta = delta;
    this.rank = rank;
    this.performance = performance;

    // For FINAL
    this.newRank = newRank;

    // For PREDICTED
    this.deltaReqForRankUp = deltaReqForRankUp;
    this.nextRank = nextRank;
  }
}

export default class PredictResponse {
  rowMap: { [handle: string]: PredictResponseRow };
  type: string;
  fetchTime: number;

  constructor(predictResults: any[], type: string, fetchTime: number) {
    PredictResponse.assertTypeOk(type);
    this.rowMap = {};
    this.type = type;
    this.fetchTime = fetchTime;
    this.populateMap(predictResults);
  }

  populateMap(predictResults: any[]) {
    for (const result of predictResults) {
      let rank, newRank, deltaReqForRankUp, nextRank;
      switch (this.type) {
        case PredictResponse.TYPE_PREDICTED:
          rank = Rank.forRating(result.rating);
          const effectiveRank = Rank.forRating(result.effectiveRating);
          deltaReqForRankUp = effectiveRank.high! - result.effectiveRating;
          nextRank = Rank.RATED[Rank.RATED.indexOf(effectiveRank) + 1] || null;  // null when LGM
          break;
        case PredictResponse.TYPE_FINAL:
          // For an unrated user, user info has missing rating but if the user participates, the
          // oldRating on the ratingChange object is set as the default starting value. So, for
          // FINAL, at the moment rating = effectiveRating always, but keeping the code which works
          // for unrated too, as things should be.
          rank = Rank.forRating(result.rating);
          newRank = Rank.forRating(result.effectiveRating + result.delta);
          break;
        default:
          throw new Error('Unknown prediction type'); // Unexpected
      }
      const performance = {
        value: result.performance === Infinity ? 'Infinity' : result.performance as string,
        colorClass: Rank.forRating(result.performance).colorClass!,
      }
      this.rowMap[result.handle] =
        new PredictResponseRow(
          result.delta, rank, performance, newRank!, deltaReqForRankUp!, nextRank!);
    }
  }

  static assertTypeOk(type: string) {
    if (!PredictResponse.TYPES.includes(type)) {
      throw new Error('Unknown prediction type: ' + type);
    }
  }

  static TYPE_PREDICTED: string = 'PREDICTED';
  static TYPE_FINAL: string = 'FINAL';
  static TYPES: string[] = [PredictResponse.TYPE_PREDICTED, PredictResponse.TYPE_FINAL];
}
