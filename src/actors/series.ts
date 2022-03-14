import { World, Actor, OrderedSystem } from "./base";
import { Message, Send, Reply } from "./message";
import { assert } from "../utils/misc";

/**
 * A composite Instruction involving multiple instructions one after another.
 */
export class Series extends OrderedSystem {
  /**
   * Tells if there is a connection from a source actor to a destination
   * actor.
   *
   * Only following connections are allowed
   * parent -> child1
   * child1..childn -> parent
   */
  // isConnected(src: string, dest: string): boolean { return src == "" || dest == ""; }

  /**
   * The first send is always routed to the first child.
   */
  routeSendToChild(send: Send, world: World): boolean {
    const next = send.spawn(this, world.currTime).setNextActor(this.childAt(0));
    this.forwardSend(next, world);
    return true;
  }

  processReplyFromChild(reply: Reply, world: World): void {
    // On a reply create a new Send mess to the "next" child in our
    // series until the end and then return back a reply
    // Now send a reply back to the caller
    // See which component this reply corresponds to
    const respTo = reply.responseTo;
    const spawnedFrom = respTo.spawnedFrom!;
    const nextIndex = spawnedFrom.children.length + 1;
    if (nextIndex >= this.childCount) {
      // All children done so send back a reply
      this.forwardReply(reply, world);
    } else {
      const next = spawnedFrom.spawn(this, world.currTime).setNextActor(this.childAt(nextIndex));
      this.forwardSend(next, world);
    }
  }
}
