import { World, Actor, OrderedSystem } from "./base";
import { Message, Send, Reply } from "./message";
import { assert } from "../utils/misc";

/**
 * A system where each of the child calls are made in parallel.
 */
export class Parallel extends OrderedSystem {
  /**
   * Tells if there is a connection from a source actor to a destination
   * actor.
   */
  isConnected(src: string, dest: string): boolean {
    // Only connection can be from the system to a child
    // or child to system.
    return src == "" || dest == "";
  }

  sendStatuses = {} as { [key: number]: boolean[] };

  /**
   * Send message to us is routed to all children.
   */
  routeSendToChild(send: Send, world: World): boolean {
    // dispatch to all children in parallel
    this.sendStatuses[send.uuid] = [];
    for (let i = 0; i < this.childCount; i++) {
      this.sendStatuses[send.uuid].push(false);
      const next = send.spawn(this, world.currTime).setNextActor(this.childAt(i));
      this.forwardSend(next, world);
    }
    return true;
  }

  processReplyFromChild(reply: Reply, world: World): void {
    // On a reply check if all sends have received replies
    // If so then we can send back a reply.
    const spawnedFrom = reply.responseTo.spawnedFrom;
    if (spawnedFrom == null) return;
    const sendStatus = this.sendStatuses[spawnedFrom.uuid];
    if (!sendStatus) return;

    // see which one it is
    const childIndex = this.indexOf(reply.source);
    if (sendStatus[childIndex] == false) {
      sendStatus[childIndex] = true;
    }

    // If all children are accounted for then send back a response
    for (const received of sendStatus) {
      if (!received) return;
    }
    this.forwardReply(reply, world);
  }
}
