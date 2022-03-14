import { World, ActorRef, Actor, System } from "./base";
import { Send, Reply } from "./message";
import { Nullable } from "../types";
import { assert } from "../utils/misc";

export class Decorator extends System {
  private _target: Actor;
  protected sendTable: { [key: number]: any } = {};

  /**
   * Get a named child of this System.
   */
  get(name: string): Nullable<Actor> {
    return name == this._target.name ? this.target : null;
  }

  get target(): Actor {
    return this._target;
  }

  set target(value: Actor) {
    assert(value.parent == this || value.parent == null, "Remove target from previous parent");
    if (this._target) {
      this._target.parent = null;
    }
    this._target = value;
    value.parent = this;
  }

  /**
   * Tells if this sytem has a child by name or instance.
   */
  has(child: ActorRef): boolean {
    return child == this._target || child == this._target!.name;
  }

  /**
   * Get the children of this System
   */
  getChildren(): IterableIterator<Actor> {
    return Array.from([this._target!]).values();
  }

  /**
   * Returns the number of children in this system.
   */
  get childCount() {
    return 1;
  }

  /**
   * Forward this to the _target by default.
   */
  routeSendToChild(send: Send, world: World): boolean {
    const newsend = send.spawn(this, world.currTime).setNextActor(this._target);
    this.forwardSend(newsend, world);
    return true;
  }

  /**
   * Forward a send from a child back out to the parent.
   */
  processSendFromChild(send: Send, world: World): boolean {
    const newsend = send.spawn(this, world.currTime);
    this.forwardSend(newsend, world);
    return true;
  }

  processReplyFromChild(reply: Reply, world: World) {
    // By default just forward the reply normally
    this.forwardReply(reply, world);
  }
}
