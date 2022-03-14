import { ONE_SEC } from "../utils/timeutils";
import { assert } from "../utils/misc";

export interface Metric {
  time: number;
  value: number;
}

/**
 * A Processor captures a series of metrics.
 */
export abstract class Metrics {
  name: string;
  label: string;
  windowSize: number;
  private _metrics: Metric[] = [];
  protected _maxTime = -1;
  protected _minValue = 0;
  protected _maxValue = 0;
  protected boundsChanged = false;

  constructor(name: string, label: string, windowSize = ONE_SEC) {
    this.name = name;
    this.label = label;
    this.windowSize = windowSize;
    this.reset();
  }

  get maxTime(): number {
    return this._maxTime;
  }
  get minValue(): number {
    return this._minValue;
  }
  get maxValue(): number {
    return this._maxValue;
  }

  add(time: number, value = 1): void {
    // Do nothing
  }

  reset(): void {
    this._metrics = [];
    this._maxTime = -1;
    this._minValue = 0;
    this._maxValue = 0;
  }

  get metrics(): Metric[] {
    if (this.boundsChanged) {
      this.boundsChanged = false;
      let minVal = 0;
      let maxVal = 0;
      const results = this._metrics;
      // TODO: can do this with a min/max stack too
      for (let i = 0; i < results.length; i++) {
        if (results[i].value < minVal) minVal = results[i].value;
        if (results[i].value > maxVal) maxVal = results[i].value;
      }
      this._minValue = minVal;
      this._maxValue = maxVal;
    }
    return this._metrics;
  }

  protected addMetric(metric: Metric): void {
    assert(metric.time > this._maxTime);
    this._maxTime = metric.time;
    this._metrics.push(metric);
    this.boundsChanged = true;
  }

  toLocalTime(time: number): number {
    return Math.floor(time / this.windowSize);
  }

  ensureTimeTill(latestTime: number): void {
    const localLatestTime = this.toLocalTime(latestTime);
    while (this.maxTime < localLatestTime - 1) {
      this.addMetric({ time: this._maxTime + 1, value: 0 });
    }
  }
}

export class CountMetrics extends Metrics {
  private lastMetric: Metric;
  currTime = 0;

  reset(): void {
    super.reset();
    this.lastMetric = this.newMetric(0);
    this.addMetric(this.lastMetric);
  }

  newMetric(t: number): Metric {
    return { time: t, value: 0 };
  }

  add(time: number, value = 1): void {
    const nextTime = this.toLocalTime(time);
    if (nextTime != this.currTime) {
      this.lastMetric = this.newMetric(nextTime);
      this.addMetric(this.lastMetric);
    }
    this.currTime = nextTime;
    this.lastMetric.value += value;
  }
}

class LatencyValues implements Metric {
  readonly percentile: number;
  time = 0;
  dirty = false;
  private windowValues = [] as number[];
  private _value = 0;

  constructor(time: number, percentile = 0.5) {
    this.time = time;
    this.percentile = percentile;
    this.dirty = true;
  }

  add(value: number): void {
    this.windowValues.push(value);
    this.dirty = true;
  }

  get value(): number {
    if (this.dirty) {
      this.dirty = false;
      const values = this.windowValues;
      let total = 0.0;
      this._value = 0.0;
      if (values.length > 0) {
        values.sort();
        const topK = Math.max(1, this.percentile * values.length);
        const nVals = values.length;
        let i = 0;
        let last = nVals - 1;
        for (; i < topK; i++, last--) {
          total += values[last];
        }
        this._value = total / i;
      }
    }
    return this._value;
  }
}

export class LatencyMetrics extends Metrics {
  currTime = 0;
  percentile = 0.5;
  private lastMetric: LatencyValues;

  constructor(name: string, label: string, percentile = 0.5, windowSize = ONE_SEC) {
    super(name, label, windowSize);
    this.percentile = percentile;
  }

  newMetric(t: number): LatencyValues {
    return new LatencyValues(t, this.percentile);
  }

  reset(): void {
    super.reset();
    this.lastMetric = this.newMetric(0);
    this.addMetric(this.lastMetric);
  }

  add(time: number, value = 1): void {
    const nextTime = this.toLocalTime(time);
    if (nextTime != this.currTime) {
      // we have a new window calculate the
      this.lastMetric = this.newMetric(nextTime);
      this.addMetric(this.lastMetric);
    }

    this.lastMetric.add(value);
    this.currTime = nextTime;
  }
}
