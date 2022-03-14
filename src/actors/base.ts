import { UUIDType, Int, Nullable, Timestamp } from "../types";
import { PropertyStore } from "../utils/properties";
import { Address, Message, Send, Reply, Interrupt } from "./message";
import { assert } from "../utils/misc";
import { property } from "../utils/properties";

export type ActorRef = Actor | string;
export type ActorVisitor = (actor: Actor) => any;

export interface World {
  currTime: Timestamp;
  random(maxVal: number): number;
  inject(message: Message): void;
  requestInterruptIn(source: Actor, deltaTime: number): Interrupt;
}

/**
 * Actors are the base classes of any physical entity that can
 * belong in a system.
 */
export class Actor extends PropertyStore {
  // Globally unique ID for all entities.
  private static counter: Int = 0;
  readonly uuid: UUIDType = Actor.counter++;
  private _metadata: any = {};
  private _defs: any = {};

  /**
   * The name of the Actor.  This *must* be unique within a System so
   * that it can be easily identified from the System.  This does *not*
   * have to be Globally unique (though we can revisit that constraint).
   * This has some interesting implications.  Actors can send messages
   * to other actors.  Referring to other actors by reference is in a
   * way call-by-value.   Doing so means we cannot swap out actors.
   *
   * However by having actors referring to others by name, we get to
   * adapt to changes in actors since the name would help us get to them.
   * Call-by-name gives us lazy and when-needed evaluation!
   */
  readonly name: string;

  /**
   * Every Entity is contained inside (or owned by) a System.  The parent
   * attribute points to the System that owns this entity.
   */
  parent: Nullable<System> = null;

  /**
   * A title for this entity.
   */
  public title: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  clone(name: string): this {
    const out = this.newInstance(name);
    this.copyTo(out);
    return out;
  }

  protected newInstance(name: string): this {
    return new (this.constructor as any)(name);
  }

  copyTo(another: this) {
    another.title = this.title;
    for (const propname in this.__properties__) {
      const prop = this.__properties__[propname];
      another.__properties__[propname] = prop.clone();
    }

    // do the same for metadata too
    for (const key in this._metadata) {
      const value = this._metadata[key];
      if (value == null || !value.clone) {
        another._metadata[key] = value;
      } else {
        another._metadata[key] = value.clone();
      }
    }
  }

  /**
   * Tells if a given child is a descendant of this System.
   */
  isDescendantOf(another: System): boolean {
    if ((this as any) == another) return true;
    for (let parent = this.parent; parent != null; parent = parent.parent) {
      if (parent == another) {
        return true;
      }
    }
    return false;
  }

  nextActorByName(name: string, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    const parent: Nullable<System> = this.parent;
    if (parent == null) return null;
    return parent.nextActorByName(name, source, this);
  }

  nextActorForAddress(address: Address, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    const parent: Nullable<System> = this.parent;
    if (parent == null) return null;
    return parent.nextActorForAddress(address, source, this);
  }

  /**
   * Resets the state of this Actor.
   */
  reset() {
    // Nothing
  }

  /**
   * Add a definition for a particular ID.  Definitions allow entries to
   * be referenced and reused without being duplicated.  Particularly useful
   * for pattern definitions for stroke and fill styles.
   *
   * @param {String}   id      ID of the entry being defined.
   * @param {Object}   value   Value of the entry being defined.
   * @returns {TypeOf<this>}   This instance.
   */
  setDef(id: string, value: any) {
    this._defs[id] = value;
  }

  /**
   * Returns the definition for a particular ID.
   * If the definition does not exist in this element, the parent (and so on) is looked
   * up until one is found or the root is reached.
   *
   * @param {String}  id  ID of the definition to be looked up.
   * @returns {Object}  Value of the definition within the closest ancestor, null if no entry found.
   */
  getDef(id: string): any {
    if (id in this._defs) {
      return this._defs[id];
    } else if (this.parent == null) {
      return null;
    }
    return this.parent.getDef(id);
  }

  /**
   * Gets a particular metadata entry.
   *
   * @param {String} key   Key of the entry to return.
   *
   * @returns {Object} Value of the key if it exists, null otherwise.
   */
  getMetaData(key: string): any {
    return this._metadata[key] || null;
  }

  /**
   * Sets a particular metadata entry.
   *
   * @param {String} key      Key of the entry to set.
   * @param {Object} value    Value of the entry to set.
   *
   * @returns {TypeOf<this>} This instance.
   */
  setMetaData(key: string, value: any): this {
    this._metadata[key] = value;
    return this;
  }

  processInterrupt(_interrupt: Interrupt, _world: World): void {
    // Nothing by default
  }

  /**
   * Called to handle a Send message to this actor.
   */
  processSend(_send: Send, _world: World): void {
    assert(false, "Sends not allowed for this actor");
  }

  /**
   * Called to handle a Reply message to this actor.
   */
  processReply(_reply: Reply, _world: World): void {
    assert(false, "Replies not allowed for this actor");
  }

  replyToSend(send: Send, world: World, deltaTime = 0, errorReason?: string): Reply {
    const outboundReply = send.spawnReply(world.currTime + deltaTime);
    if (errorReason) {
      outboundReply.isError = true;
      outboundReply.errorReason = errorReason;
    }
    world.inject(outboundReply);
    return outboundReply;
  }

  forwardSend(send: Send, world: World): void {
    assert(send.source == this, "Cannot send messages whose source is not this.");
    world.inject(send);
  }

  forwardReply(inboundReply: Reply, world: World, deltaTime = 0): Nullable<Reply> {
    assert(inboundReply.nextActor == this, "Cannot forward replies whose nextActor is not this.");
    assert(
      inboundReply.responseTo.spawnedFrom != null,
      "Cannot spawn a reply for a send that itself was not spawned from another send",
    );
    const spawnedFromSend = inboundReply.responseTo.spawnedFrom;
    if (spawnedFromSend.reply == null) {
      // we are receiving a reply from the downstream so forward it back
      const outboundReply = inboundReply.spawn(spawnedFromSend, world.currTime + deltaTime);
      world.inject(outboundReply);
      return outboundReply;
    } else {
      // This send had already been replied (ie with an error - say due to timeout, act of god etc)
      // So we can ignore sending this reply
      return null;
    }
  }

  static visit(actor: Actor, callback: ActorVisitor): boolean {
    if (callback(actor) == false) return false;
    if ("getChildren" in actor) {
      const children = (actor as System).getChildren();
      for (const child of children) {
        if (Actor.visit(child, callback) == false) return false;
      }
    }
    return true;
  }
}

/**
 * Processor classes as a super class of all Actors that are at the leaf
 * level and wont have any children.
 */
export abstract class Processor extends Actor {
  /**
   * The velocity of ramp as a percentage of the differnce between the
   * current and nextActor QPS
   */
  // @property({ defaultValue: 0, units: "% per sec" })
  testProperty = 10;
}

/**
 * Systems are the composite actors in universe.  Where actors are
 * leaf level devices, Systems can thought about as a collections of
 * actors that come together to provide a higher level purpose - eg:
 *      Airline Booking System
 *      ID Generation System
 *      TinyURL System etc.
 *
 * Systems themselves can be used as modular entities in a design.  This
 * lets us create Systems once but used in various places.
 */
export abstract class System extends Actor {
  /**
   * Get a named child of this System.
   */
  abstract get(name: string): Nullable<Actor>;

  /**
   * Tells if this sytem has a child by name or instance.
   */
  abstract has(child: ActorRef): boolean;

  /**
   * Get the children of this System
   */
  abstract getChildren(): IterableIterator<Actor>;

  /**
   * Returns the number of children in this system.
   */
  abstract get childCount(): number;

  nextActorByName(name: string, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    const child = this.get(name);
    if (child != null) return child;
    const parent: Nullable<System> = this.parent;
    if (parent == null) return null;
    return parent.nextActorByName(name, source, this);
  }

  nextActorForAddress(address: Address, source: Actor, prev: Nullable<Actor> = null): Nullable<Actor> {
    const child = this.get(address.dest);
    if (child != null) return child;
    const parent: Nullable<System> = this.parent;
    if (parent == null) return null;
    return parent.nextActorForAddress(address, source, this);
  }

  protected validateChildBeforeAdding(child: Actor) {
    if (this.has(child.name)) {
      throw new Error(
        `Child with given name (${child.name}) already exists in the system.  Create child with a different name.`,
      );
    }
    if (child instanceof System && this.isDescendantOf(child)) {
      throw new Error(`Child (${child.name}) is already an ancestor of this System (${this.name})`);
    }
    if (child.parent != null && child.parent != this) {
      throw new Error(
        `Child (${child.name}) already belongs to another System (${child.parent.name}).  Remove it first or clone it`,
      );
    }
  }

  /**
   * Processing a message here is only a matter of routing the message
   * to a child.
   */
  processSend(send: Send, world: World) {
    assert(send.nextActor == this, "Messages must be targetted to this actor");
    let handled = false;
    if (send.source.parent == this) {
      // send is coming from a child
      handled = this.processSendFromChild(send, world);
    } else {
      // coming from outside so route send to a child
      handled = this.routeSendToChild(send, world);
    }
    if (!handled) {
      const reply = send.spawnReply(world.currTime);
      reply.isError = true;
      reply.errorReason = "No destination found.";
      world.inject(reply);
    }
  }

  routeSendToChild(_send: Send, _world: World): boolean {
    return false;
  }

  processSendFromChild(_send: Send, _world: World): boolean {
    return false;
  }

  processReply(reply: Reply, world: World) {
    assert(reply.nextActor == this, "Messages must be targetted to this actor");
    // we cannot have a reply coming from outside the system to us
    // since we do not originate send messges yet (not supported).
    if (reply.source.parent == this) {
      this.processReplyFromChild(reply, world);
    } else {
      this.routeReplyToChild(reply, world);
    }
  }

  processReplyFromChild(reply: Reply, world: World) {
    // By default just forward the reply normally
    this.forwardReply(reply, world);
  }

  routeReplyToChild(reply: Reply, world: World) {
    // By default just forward the reply normally
    this.forwardReply(reply, world);
  }
}

export class OrderedSystem extends System {
  private children = new Array<Actor>();
  private childIndexes = new Set<UUIDType>();

  push(...children: Actor[]): this {
    for (const child of children) {
      this.validateChildBeforeAdding(child);
      child.parent = this;
      if (!this.childIndexes.has(child.uuid)) {
        this.childIndexes.add(child.uuid);
        this.children.push(child);
      }
    }
    return this;
  }

  getChildren(): IterableIterator<Actor> {
    return this.children.values();
  }

  /**
   * Returns the child at a given index.
   */
  childAt(index: number): Actor {
    return this.children[index];
  }

  /**
   * Returns the number of children in this system.
   */
  get childCount(): number {
    return this.children.length;
  }

  /**
   * Get a named child of this System.
   */
  get(name: string): Nullable<Actor> {
    for (const child of this.children) {
      if (child.name == name) return child;
    }
    return null;
  }

  /**
   * Tells if this sytem has a child by name or instance.
   */
  has(child: ActorRef): boolean {
    return this.indexOf(child) >= 0;
  }

  /**
   * Returns the index of a given child.
   */
  indexOf(child: ActorRef): number {
    let name: string;
    if (typeof child === "string") {
      name = child as string;
    } else {
      name = (child as Actor).name;
    }
    for (let i = 0; i < this.children.length; i++) {
      const ch = this.children[i];
      if (ch.name == name) return i;
    }
    return -1;
  }

  copyTo(another: this): void {
    another.children = this.children.map((x) => x.clone(x.name));
  }
}
