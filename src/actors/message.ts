import { Nullable, Timestamp } from "../types";
import { Actor } from "./base";
import { assert } from "../utils/misc";

export type Message = Send | Reply; // | Interrupt;

export enum MessageType {
  SEND = 0,
  REPLY = 1,
  INTERRUPT = 2,
}

export class Address {
  /**
   * Name of the destination
   */
  readonly dest: string;

  /**
   * Name of the method.
   */
  readonly method: string;

  constructor(dest: string, method: string) {
    this.dest = dest;
    this.method = method;
  }

  clone(): Address {
    return new Address(this.dest, this.method);
  }
}

export class MessageBase {
  // Globally unique ID for all elements.
  private static counter = 0;
  readonly uuid = MessageBase.counter++;

  /**
   * The time at which the message will be scheduled for and must NOT be
   * processed earlier than this time.
   */
  readonly time: Timestamp;

  /**
   * The actor this message originated from.
   */
  readonly source: Actor;

  /**
   * Data that can be set by the source actor that only *it* can
   * use Note we dont have a similar one for targetData because
   * messages are created by a source actor and often it is fair
   * they do not have an idea of who/what the destinations or next
   * actors are.
   */
  sourceData: any = null;

  /**
   * Message payload.
   * Specific to the message.
   */
  payload: any = null;

  /**
   * Descriptive label for the Message.
   */
  label: string;

  constructor(source: Actor, time: Timestamp) {
    assert(source != null, "Source cannot be null");
    this.source = source;
    this.time = time;
  }
}

export class Interrupt extends MessageBase {
  readonly type: MessageType = MessageType.INTERRUPT;
}

abstract class ForwardableBase<T> extends MessageBase {
  /**
   * The next actor this message is intended to.
   * This will be set by the world in which messages are forwarded
   * and routed.  In most cases the nextActor will be determined
   * by several factors like address of a Send, source of source
   * and spawned messages etc.
   */
  private _nextActor: Nullable<Actor> = null;
  private _nextActorName: Nullable<string> = null;

  /**
   * The first/root message in the forward chain.
   */
  private _rootMessage: ForwardableBase<T>;

  /**
   * The message that is being forwarded.
   */
  private _spawnedFrom: Nullable<this> = null;

  get nextActor(): Nullable<Actor> {
    return this._nextActor;
  }

  setNextActor(newValue: Actor): this {
    assert(this._nextActor == null, "nextActor has already been set.  Cannot be replaced");
    this._nextActor = newValue;
    this._nextActorName = newValue.name;
    return this;
  }

  get nextActorName(): Nullable<string> {
    return this._nextActorName;
  }

  setNextActorByName(newValue: string): this {
    assert(this._nextActorName == null, "nextActorName has already been set.  Cannot be replaced");
    this._nextActor = null;
    this._nextActorName = newValue;
    return this;
  }

  get spawnedFrom(): Nullable<this> {
    return this._spawnedFrom;
  }

  protected setSpawnedFrom(msg: Nullable<this>) {
    this._spawnedFrom = msg;
    if (msg == null) this._rootMessage = this;
    else this._rootMessage = msg.rootMessage;
  }

  get rootMessage(): this {
    return this._rootMessage as this;
  }
}

export class Reply extends ForwardableBase<Reply> {
  readonly type: MessageType = MessageType.REPLY;

  /**
   * The message this is in response to
   */
  responseTo: Send;

  /**
   * Whether this reply is an error or not.
   */
  isError: boolean;

  /**
   * If Reply is an error then a few summary fields about the error.
   */
  errorReason: string;

  constructor(responseTo: Send, time: Timestamp) {
    super(responseTo.nextActor!, time);
    assert(responseTo.reply == null, "Send's reply has already been set");
    this.setNextActor(responseTo.source);
    this.responseTo = responseTo;
    this.isError = false;
    this.errorReason = "";
    responseTo.reply = this;
  }

  spawn(responseTo: Send, time: Timestamp): Reply {
    const child = new Reply(responseTo, time);
    child.setSpawnedFrom(this);
    child.isError = this.isError;
    child.errorReason = this.errorReason;
    return child;
  }
}

export class Send extends ForwardableBase<Send> {
  readonly type: MessageType = MessageType.SEND;

  /**
   * All child sends that were spawned from this Send.
   * The parent/spawnedFrom and child message references help us
   * form a call tree/trace of a message as it traverses
   * the system.
   */
  children: Send[] = [];

  /**
   * Tells which message is a reply to this message.
   */
  reply: Nullable<Reply> = null;

  /**
   * When the Send was cancelled (if it was).
   */
  cancelledAt: Nullable<number> = null;

  /**
   * The final address where this Send is destined to.
   */
  address: Address;

  constructor(source: Actor, time: Timestamp, address: Address) {
    super(source, time);
    this.address = address;
  }

  spawn(source: Actor, time: Timestamp, address?: Address): Send {
    const child = new Send(source, time, address || this.address);
    assert(this.nextActor == source, "Next actor must be set before spawning");
    child.setSpawnedFrom(this);
    this.children.push(child);
    return child;
  }

  spawnReply(time: Timestamp): Reply {
    return new Reply(this, time);
  }
}
