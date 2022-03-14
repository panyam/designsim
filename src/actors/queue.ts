import { LinkedList } from "typescriptcollectionsframework";
import { assert } from "../utils/misc";
import { Send, Reply, Interrupt } from "./message";
import { property } from "../utils/properties";
import { World } from "./base";
import { Decorator } from "./decorator";
import { Nullable } from "../types";

/**
 * A queue that can be used "infront" of a particular actor to give
 * the actor the ability to queue requests it gets instead of
 * having every actor implement its own queueing (either manualy or
 * by extending a common base class).
 */
export class Queue extends Decorator {
  /**
   * How many parallel processes can be serving a message at a time.
   */
  @property({ defaultValue: 1, beforeSetterName: "shouldSetMaxServers", minValue: 1 })
  maxServers = 1;

  /**
   * How many messages can be in the queue before they are dropped?
   * Alternatively this can also be specified as a timeout
   * value instead of queue length.  Messages beyond timeout will be
   * erroring out.
   * <= 0 => Infinite queue length
   */
  @property({ defaultValue: 100, minValue: 0 })
  maxQueueSize = 0;

  /**
   * The queue of messages onto which we are pushing messages
   * when no servers are available.
   */
  sendQueue = new LinkedList<Send>();

  /**
   * How many servers are currently active.
   */
  private numActiveServers = 0;

  /**
   * Used for diagnostics only for testing.
   */
  get diagnostics() {
    return {
      numActiveServers: this.numActiveServers,
      queueSize: this.sendQueue.size(),
    };
  }

  routeSendToChild(send: Send, world: World): boolean {
    this.flushMessages(world);
    if (this.numActiveServers >= this.maxServers) {
      if (this.maxQueueSize > 0 && this.sendQueue.size() >= this.maxQueueSize) {
        // Queue full so send back an error
        this.replyToSend(send, world, 0, "Queue Full");
      } else {
        // Add to queue
        this.sendQueue.offerLast(send);
      }
    } else {
      // we are free so forward it
      this.acquireServer();
      super.routeSendToChild(send, world);
    }
    return true;
  }

  processReplyFromChild(reply: Reply, world: World): void {
    // forward it back and release our server
    this.forwardReply(reply, world);
    this.releaseServer();
    this.flushMessages(world);
  }

  processInterrupt(_interrupt: Interrupt, world: World): void {
    this.flushMessages(world);
  }

  protected releaseServer() {
    assert(this.numActiveServers > 0, "Num active servers must be +ve");
    this.numActiveServers--;
  }

  protected acquireServer() {
    this.numActiveServers++;
  }

  protected flushMessages(world: World) {
    // we are woken up to handle more messages.
    // Here we need to check when a server can be returned to the idle state.
    // We have a bunch of workers - but how do we know when a worker is "free"?
    // the worker basically calls the "child" to do its thing
    while (!this.sendQueue.isEmpty() && this.numActiveServers < this.maxServers) {
      const send = this.sendQueue.pollFirst();
      this.acquireServer();
      super.routeSendToChild(send, world);
    }
  }

  shouldSetMaxServers(newValue: number) {
    // nothing yet
  }
}
