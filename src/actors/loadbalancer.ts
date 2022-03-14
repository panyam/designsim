import { property } from "../utils/properties";
import { World, Processor } from "./base";
import { Address, Send } from "./message";
import { Millis } from "../utils/timeutils";

export class LoadBalancer extends Processor {
  /**
   * How long does it take to forward a message?
   */
  @property({ defaultValue: Millis(1) })
  forwardingLatency: number;

  /**
   * Target components to forward a request to.
   */
  targets: string[] = [];

  /**
   * Adds a name of a target to forward an incoming request to.
   */
  add(target: string) {
    this.targets.push(target);
  }

  randomTarget(world: World) {
    const r = world.random(this.targets.length);
    return this.targets[r];
  }

  processSend(send: Send, world: World) {
    // create a new output event to "forward" to one of the targets
    const out = send.spawn(this, world.currTime + this.forwardingLatency).setNextActorByName(this.randomTarget(world));
    this.forwardSend(out, world);
  }
}
