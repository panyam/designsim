import { assert } from "../utils/misc";
import { property } from "../utils/properties";
import { Address, Send, Reply, Interrupt } from "./message";
import { World, Actor } from "./base";
import { Decorator } from "./decorator";
import { Nullable } from "../types";
import { PQ } from "../utils/pq/pq";
import { ONE_SEC } from "../utils/timeutils";

/**
 * An actor that applies a timeout for all Sends from the actor it decorates.
 */
export class Timeout extends Decorator {
  /**
   * Timeouts specific for each dest and method and their
   * respective methods.
   */
  private destAddresses: Address[] = [];
  private destTimeouts: number[] = [];

  /**
   * Default timeout when other rules do not match.
   */
  @property({ defaultValue: ONE_SEC, minValue: 0 })
  defaultTimeout = ONE_SEC;

  /**
   * The list of Sends that have not yet received a reply so we
   * can time them out when well the time comes.
   */
  sendQueue = new PQ<Send>(
    (s1, s2) => s1.sourceData - s2.sourceData,
    (s) => s.uuid,
  );

  /**
   * Used for diagnostics only for testing.
   */
  get diagnostics() {
    return {
      queueSize: this.sendQueue.size,
    };
  }

  /**
   * Add a timeout for a dest name and dest method pair.
   */
  addTimeout(name: string, method: string, value: number): void {
    this.destAddresses.push(new Address(name, method));
    this.destTimeouts.push(value);
  }

  reset() {
    this.sendQueue.clear();
  }

  copyTo(out: this) {
    out.destAddresses = this.destAddresses.map((addr) => addr.clone());
    out.destTimeouts = [...this.destTimeouts];
  }

  /**
   * When a send is received from a child, we forward it out
   * and start counting down the time.
   */
  processSendFromChild(send: Send, world: World): boolean {
    // Also request interrupt for our timeout for this send
    const timeout = this.timeoutFor(send.address.dest, send.address.method);
    const interrupt = world.requestInterruptIn(this, timeout);

    const forward = send.spawn(this, send.time);
    // Set when this forward will expire
    forward.sourceData = interrupt.time;
    this.sendQueue.push(forward);

    this.forwardSend(forward, world);
    return true;
  }

  routeReplyToChild(reply: Reply, world: World): void {
    const send = reply.responseTo;
    this.sendQueue.removeValue(send);
    if (send.cancelledAt == null) {
      // forward it as this looks like a kosher send inside
      // the timeout
      this.forwardReply(reply, world);
    }
  }

  timeoutFor(name: string, method: string): number {
    for (let i = 0; i < this.destAddresses.length; i++) {
      const destName = this.destAddresses[i].dest;
      const destMethod = this.destAddresses[i].method;
      if ((destName == "*" || destName == name) && (destMethod == "*" || destMethod == method)) {
        return this.destTimeouts[i];
      }
    }
    return this.defaultTimeout;
  }

  /**
   * Goes through and removes all Sends that have timed out
   * and returns a Timeout reply for all those sends back to
   * the sender.
   */
  protected applyTimeouts(world: World) {
    const currTime = world.currTime;
    while (!this.sendQueue.isEmpty) {
      const top = this.sendQueue.top;
      const send: Send = top.value;
      const expiresAt = send.sourceData;
      assert(expiresAt != null, "expiresAt not found for send");
      if (expiresAt <= currTime) {
        this.sendQueue.pop();

        assert(send.spawnedFrom != null, "Forwarded messages does not have a spawnedFrom");
        send.spawnedFrom.cancelledAt = currTime;
        this.replyToSend(send.spawnedFrom, world, 0, "Timed out");
      } else {
        // if top of the sendqueue has not timedout
        // others wont have too so we can stop now
        break;
      }
    }
  }

  processInterrupt(_interrupt: Interrupt, world: World): void {
    this.applyTimeouts(world);
  }

  nextActorByName(name: string, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    if (prev == this.target) return this;
    return super.nextActorByName(name, source, this);
  }

  nextActorForAddress(address: Address, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    if (prev == this.target) return this;
    return super.nextActorForAddress(address, source, this);
  }
}
