import { Nullable } from "../types";
import { ActorRef, Actor, World, Processor } from "./base";
import { Address, Send, Reply } from "./message";
import { property } from "../utils/properties";
import { assert } from "../utils/misc";
import { Millis } from "../utils/timeutils";

/**
 * A actor that sends a message to another actor and optionally
 * waits for a response.
 */
export class Call extends Processor {
  readonly address: Address;
  // private _target: Nullable<Actor> = null;

  /**
   * How long does it take to forward a message to a downstream (in ns).
   */
  @property({ defaultValue: Millis(0), units: "ns", minValue: 0 })
  callLatency: number;

  /**
   * How long does it take to forward a reply to an upstream (in ns).
   */
  @property({ defaultValue: Millis(0), units: "ns", minValue: 0 })
  replyLatency: number;

  constructor(name: string, destName: string, destMethod: string) {
    super(name);
    this.address = new Address(destName, destMethod);
  }

  newInstance(name: string): this {
    return new (this.constructor as any)(name, this.address.dest, this.address.method);
  }

  /**
   * Called to handle another message.
   * This Actor can either ignore this message, do something with it
   * and/or even create new messages for the future.
   */
  processSend(send: Send, world: World): void {
    assert(send.nextActor == this, "Call actors should not get requests not targetting them");
    // save the send
    const nextActor = this.nextActorForAddress(this.address, this);
    if (nextActor == null) {
      this.replyToSend(send, world, 0, "Cannot find destination: " + this.address.dest);
    } else {
      const nextMessage = send.spawn(this, world.currTime + this.callLatency, this.address).setNextActor(nextActor);
      this.forwardSend(nextMessage, world);
    }
  }

  processReply(reply: Reply, world: World): void {
    assert(reply.nextActor == this, "Call actors should not get requests not targetting them");
    this.forwardReply(reply, world, this.replyLatency);
  }
}
