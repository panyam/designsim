import { property } from "../utils/properties";
import { Nullable } from "../types";
import { World, Actor, Processor } from "./base";
import { Address, Reply, Interrupt, Send } from "./message";
import { ONE_SEC } from "../utils/timeutils";

/**
 * A Generator is a actor that generates traffic by inspecting methods
 * of the targets it is connected to and calling them in some weighted
 * random distribution.   The creation rates etc can be specific for
 * the client.
 */
export class Generator extends Processor {
  private destAddresses: Address[] = [];
  private destWeights: number[] = [];
  private _nextActors: Nullable<Actor>[] = [];
  private cumulWeights: number[] = [];
  private _totalWeight = 0;
  private _started = false;
  private _round = 0;

  /**
   * Last time when traffic was generated.
   */
  private lastSentAt = -1;
  private lastSentRealTime = -1;

  /**
   * The velocity of ramp as a percentage of the differnce between the
   * current and target QPS
   */
  @property({ defaultValue: 10, beforeSetterName: "shouldSetRampRate", units: "% per sec" })
  rampRate = 10;

  /**
   * What is our target QPS?
   */
  @property({ defaultValue: 1, beforeSetterName: "shouldSetTargetQPS", minValue: 0, units: "QPS" })
  targetQPS = 1;

  /**
   * When a new QPS is set, the following dictate the current and starting
   * QPS as the QPS is ramped.
   *
   * For now we only support a linear ramp rate.
   */
  private _currentQPS = 1;
  private _deltaQPS = 0;

  get round() {
    return this._round;
  }

  get started(): boolean {
    return this._started;
  }

  destAt(index: number) {
    return { ...this.destAddresses[index], weight: this.destWeights[index] };
  }

  get destCount() {
    return this.destAddresses.length;
  }

  get totalWeight() {
    return this._totalWeight;
  }

  get currentQPS() {
    return this._currentQPS;
  }

  /**
   * Sets the current QPS if it is on the way to target QPS.
   * Note that even after the currentQPS it can change in the next
   * event cycle based on the values of the ramp and targetQPS values.
   */
  set currentQPS(currQPS: number) {
    if (currQPS >= this._currentQPS && currQPS <= this.targetQPS) {
      this._currentQPS = currQPS;
    } else if (currQPS >= this.targetQPS && currQPS <= this._currentQPS) {
      this._currentQPS = currQPS;
    }
  }

  get deltaQPS() {
    return this._deltaQPS;
  }

  shouldSetTargetQPS(newValue: number) {
    this.rampTo(newValue, this.rampRate);
  }

  shouldSetRampRate(newValue: number) {
    this.rampTo(this.targetQPS, newValue);
  }

  private rampTo(targetQPS: number, rampRate: number) {
    const delta = targetQPS - this._currentQPS;
    if (delta < 0) {
      this._deltaQPS = Math.min(-1, (delta * rampRate) / 100);
    } else {
      this._deltaQPS = Math.max(1, (delta * rampRate) / 100);
    }
  }

  add(destName: string, destMethod: string, weight = 1) {
    this.destAddresses.push(new Address(destName, destMethod));
    this._nextActors.push(null);
    weight = Math.abs(weight);
    this.destWeights.push(weight);
    const L = this.cumulWeights.length;
    this.cumulWeights.push(L == 0 ? weight : weight + this.cumulWeights[L - 1]);
    this._totalWeight += weight;
    return this;
  }

  copyTo(out: this) {
    out.destWeights = [...this.destWeights];
    out.destAddresses = this.destAddresses.map((addr) => addr.clone());
    out._nextActors = [];
    out._totalWeight = this._totalWeight;
    this.destAddresses.forEach((x) => out._nextActors.push(null));
  }

  randomIndex(world: World): number {
    const r = world.random(this._totalWeight);
    // TODO - do binary search instead
    for (let i = 0; i < this.cumulWeights.length; i++) {
      if (this.cumulWeights[i] > r) {
        return i;
      }
    }
    throw new Error("Unexpected");
  }

  start(world: World) {
    if (!this._started) {
      this._started = true;
      // send an interrupt
      world.requestInterruptIn(this, 0);
    }
  }

  stop() {
    this._started = false;
  }

  reset() {
    super.reset();
    this._started = false;
    this.lastSentAt = -1;
  }

  processReply(_reply: Reply, _world: World) {
    // Does nothing
  }

  sendOneRound(world: World) {
    // we are good to generate more requests
    let currQPS = this._currentQPS;
    if (currQPS > 20) {
      // Then introduce a small error
      const delta = Math.floor(0.1 * currQPS);
      currQPS += world.random(2 * delta) - delta;
    }
    for (let i = 0; i < currQPS; i++) {
      const r = this.randomIndex(world);
      const destAddress = this.destAddresses[r];
      let nextActor = this._nextActors[r];
      if (nextActor == null) {
        nextActor = this._nextActors[r] = this.nextActorForAddress(destAddress, this);
        if (nextActor == null) {
          throw new Error("Cannot find destination: " + destAddress.dest);
        }
      }
      const timeDelta = world.random(ONE_SEC);
      const sendTime = world.currTime + timeDelta;
      const send = new Send(this, sendTime, destAddress).setNextActor(nextActor);
      send.label = `Round: ${this._round}, Message: ${i}`;
      this.forwardSend(send, world);
    }
    this.lastSentAt = world.currTime;
  }

  /**
   * This actor ensures that each of the calls are run in series one
   * after another.  Later on this will be extended to carry forward
   * results from one call to another.
   */
  processInterrupt(interrupt: Interrupt, world: World) {
    if (!this._started) return;

    // time to send some traffic
    const delta = world.currTime - this.lastSentAt;
    if (this.lastSentAt < 0 || delta >= ONE_SEC) {
      if (false) {
        const currRealTime = Date.now();
        if (this.lastSentRealTime > 0) {
          // see how long the last interrupt to now actually took
          console.log(
            "Counter",
            interrupt.uuid,
            "Round",
            this._round,
            "Processing Time (s): ",
            currRealTime - this.lastSentRealTime,
          );
        }
        this.lastSentRealTime = currRealTime;
      }
      this._round++;
      this.sendOneRound(world);
      // console.log("Round", this._round, "Num Messages: ", this._currentQPS);
      world.requestInterruptIn(this, ONE_SEC);
      this.rampQPS();
    } else {
      // send another interrupt for delta and return
      world.requestInterruptIn(this, ONE_SEC - delta);
    }
  }

  rampQPS() {
    // udpate our _currentQPS based on the ramp rates
    this._currentQPS += this._deltaQPS;
    if (
      (this._deltaQPS > 0 && this._currentQPS > this.targetQPS) ||
      (this._deltaQPS < 0 && this._currentQPS < this.targetQPS)
    ) {
      this._currentQPS = this.targetQPS;
      this._deltaQPS = 0;
    }
  }
}
