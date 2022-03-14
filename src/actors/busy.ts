import { World, Processor } from "./base";
import { Send } from "./message";
import { property } from "../utils/properties";

/**
 * This is used to model opaque calls within the component without
 * any more branch-outs (eg these are leaf calls that would just take
 * some CPU time).
 *
 * This actor does *not* generate messages autonomously.  It only
 * responds when called with a message.
 */
export class Busy extends Processor {
  @property({ defaultValue: 10 })
  waitTime: number;

  @property({ defaultValue: 1 })
  availability: number;

  /**
   * Called to handle another message.
   * This Actor can either ignore this message, do something with it
   * and/or even create new messages for the future.
   */
  processSend(send: Send, world: World) {
    this.replyToSend(send, world, this.waitTime);
  }
}
