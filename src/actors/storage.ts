import { World, Processor } from "./base";
import { Send } from "./message";
import { property } from "../utils/properties";
import { Millis } from "../utils/timeutils";

export class Storage extends Processor {
  // Maximum number of bytes disk can hold
  @property()
  capacity: number;

  // Time to read one actor/record of data (~4kb) in ms
  @property({ defaultValue: Millis(10) })
  readLatency: number;

  @property({ defaultValue: Millis(30) })
  writeLatency: number;

  // Annualized failure rate of a disk
  @property({ defaultValue: 0.01 })
  failureRate: number;

  // private static INPUT_NAMES = ["read", "write"] as string[];
  // get inputNames() { return Storage.INPUT_NAMES; }

  /**
   * Called to handle another message.
   * This Actor can either ignore this message, do something with it
   * and/or even create new messages for the future.
   */
  processSend(send: Send, world: World): void {
    if (send.address.method == "read") {
      this.replyToSend(send, world, this.readLatency);
    } else if (send.address.method == "write") {
      this.replyToSend(send, world, this.writeLatency);
    } else {
      this.replyToSend(send, world, 0, "Invalid method: " + send.address.method);
    }
  }
}
