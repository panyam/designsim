import { Nullable } from "../../types";
import { Processor, ActorRef, Actor, World, System } from "../base";
import { MessageType, Send, Reply, Message, Interrupt } from "../message";
import { Simulator } from "../simulator";

export function logMessage(prefix: string, message: Message): void {
  if (message.type == MessageType.SEND) {
    console.log(
      `${message.time} - (${message.type}): S(${message.source.name}/${message.source.uuid}) -> "${
        (message as any).name
      }" -> T(${message.nextActor?.name}/${message.nextActor?.uuid})`,
    );
  } else if (message.type == MessageType.REPLY) {
    console.log(
      `${message.time} - (${message.type}): T(${message.nextActor?.name}/${message.nextActor?.uuid}) <- "${
        (message as any).name
      }" <- S(${message.source.name}/${message.source.uuid})`,
    );
  }
}

export class TestSimulator extends Simulator {
  randomFunc = (maxVal: number, _index: number): number => {
    this.randomCount++;
    return Math.floor(Math.random() * maxVal);
  };
  randomCount = 0;
  rootSends = [] as Send[];
  injectedMessages = [] as (Message | Interrupt)[];
  processedMessages = [] as (Message | Interrupt)[];

  constructor() {
    super();
    this.sendProcessed = (send: Send) => {
      this.processedMessages.push(send);
      if (send.spawnedFrom == null) {
        this.rootSends.push(send);
      }
      // logMessage("", send);
    };

    this.replyProcessed = (reply: Reply) => {
      this.processedMessages.push(reply);
      // logMessage("", reply);
    };
  }

  interruptProcessed(interrupt: Interrupt) {
    this.processedMessages.push(interrupt);
    // override this
  }

  inject(message: Message): void {
    super.inject(message);
    this.injectedMessages.push(message);
  }

  requestInterruptIn(source: Actor, deltaTime: number): Interrupt {
    const interrupt = super.requestInterruptIn(source, deltaTime);
    this.injectedMessages.push(interrupt);
    return interrupt;
  }

  random(maxVal: number): number {
    return this.randomFunc(this.randomCount++, maxVal);
  }

  runTillEnd() {
    let i = 0;
    while (this.step() > 0 && i < 10000) i++;
    expect(this.eventQueue.isEmpty).toBe(true);
  }

  expectMessage(msg: Message | Interrupt, value: Send | Reply | Interrupt | any): void {
    if (value instanceof Send || value instanceof Reply || value instanceof Interrupt) {
      expect(msg).toBe(value);
    } else {
      // check each of the params
      for (const key in value) {
        const comps = key.split(".");
        let msgAttr = msg as any;
        comps.forEach((c) => (msgAttr = msgAttr[c]));
        const expectedAttr = value[key];
        expect(msgAttr).toBe(expectedAttr);
      }
    }
  }

  expectInjected(index: number, value: Send | Reply | Interrupt | any): void {
    this.expectMessage(this.injectedMessages[index], value);
  }

  expectProcessed(index: number, value: Send | Reply | Interrupt | any): void {
    this.expectMessage(this.processedMessages[index], value);
  }
}

export class MockWorld implements World {
  randomFunc = (maxVal: number, _index: number): number => {
    this.randomCount++;
    return Math.floor(Math.random() * maxVal);
  };
  randomCount = 0;
  messages = [] as (Message | Interrupt)[];
  currTime = 0;
  inject(message: Message): void {
    this.messages.push(message);
  }

  requestInterruptIn(source: Actor, deltaTime: number): Interrupt {
    const interrupt = new Interrupt(source, deltaTime + this.currTime);
    this.messages.push(interrupt);
    return interrupt;
  }

  /**
   * Returns a random integer between 0 and maxVal.
   */
  random(maxVal: number): number {
    return this.randomFunc(this.randomCount++, maxVal);

    /*
    assert(this.randoms.length > 0, "No more randoms seeded. So far: " + this.randomCount);
    this.randomCount++;
    const next = this.randoms.splice(0, 1)[0];
    assert(next >= 0 && next < 1, "Mocked randoms must be 0 and 1.  Found: " + next);
    return Math.floor(maxVal * next);
    */
  }
}

export function withWorld(callback: (world: MockWorld) => void): void {
  const world = new MockWorld();
  callback(world);
}

export class MockSystem extends System {
  /**
   * Get a named child of this System.
   */
  getCount = 0;
  getFunc?: (name: string) => Nullable<Actor>;
  get(name: string): Nullable<Actor> {
    this.getCount++;
    if (this.getFunc) return this.getFunc(name);
    return null;
  }

  /**
   * Tells if this sytem has a child by name or instance.
   */
  hasCount = 0;
  hasFunc?: (child: ActorRef) => boolean;
  has(child: ActorRef): boolean {
    this.hasCount++;
    if (this.hasFunc) return this.hasFunc(child);
    return false;
  }

  /**
   * Get the children of this System
   */
  getChildrenCount = 0;
  getChildrenFunc?: () => IterableIterator<Actor>;
  getChildren(): IterableIterator<Actor> {
    this.getChildrenCount++;
    if (this.getChildrenFunc) return this.getChildrenFunc();
    return new Map<string, Actor>().values();
  }

  /**
   * Returns the number of children in this system.
   */
  childCountCount = 0;
  childCountFunc?: () => number;
  get childCount(): number {
    this.childCountCount++;
    if (this.childCountFunc) return this.childCountFunc();
    return 0;
  }

  processSendFromChildCount = 0;
  processSendFromChildFunc?: (send: Send, world: World) => boolean;
  processSendFromChild(send: Send, world: World): boolean {
    this.processSendFromChildCount++;
    if (this.processSendFromChildFunc) {
      return this.processSendFromChildFunc(send, world);
    } else {
      return super.processSendFromChild(send, world);
    }
  }

  routeSendToChildCount = 0;
  routeSendToChildFunc?: (send: Send, world: World) => boolean;
  routeSendToChild(send: Send, world: World): boolean {
    this.routeSendToChildCount++;
    if (this.routeSendToChildFunc) {
      return this.routeSendToChildFunc(send, world);
    } else {
      return super.routeSendToChild(send, world);
    }
  }

  processReplyFromChildCount = 0;
  processReplyFromChildFunc?: (reply: Reply, world: World) => void;
  processReplyFromChild(reply: Reply, world: World): void {
    this.processReplyFromChildCount++;
    if (this.processReplyFromChildFunc) {
      this.processReplyFromChildFunc(reply, world);
    } else {
      super.processReplyFromChild(reply, world);
    }
  }
}

export class ReplyLogger extends Processor {
  received = [] as Reply[];
  processReply(reply: Reply, _world: World) {
    this.received.push(reply);
  }
}

export class SendEchoer extends Processor {
  replyLatency = 10;
  errorReason?: string;
  processSend(send: Send, world: World) {
    this.replyToSend(send, world, this.replyLatency, this.errorReason);
  }
}
