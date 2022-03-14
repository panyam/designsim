import { Nullable, Timestamp } from "../types";
import { Actor } from "./base";
import { MessageType, Message, Interrupt, Send, Reply } from "./message";
import { assert } from "../utils/misc";
import { NextEventList } from "./nel";
import { PQNextEventList as NEL } from "./nel";
// import { DefaultNextEventList as NEL } from "./nel";

export class Simulator {
  /**
   * The last time when the simulation was performed.
   */
  private _currTime = 0;

  readonly eventQueue: NextEventList = new NEL();

  sendProcessed = (_send: Send) => {
    // nothing
  };
  replyProcessed = (_reply: Reply) => {
    // nothing
  };

  /**
   * Returns a random integer between 0 and maxVal.
   */
  random(maxVal: number): number {
    return Math.floor(Math.random() * maxVal);
  }

  /**
   * The last time when the simulation was performed.
   */
  get currTime(): Timestamp {
    return this._currTime;
  }

  /**
   * Reset the simulator and all actors to their initial reset state.
   */
  reset(): void {
    this._currTime = 0;
    this.eventQueue.clear();
  }

  /**
   * Step until there are more events left or more work to be done
   * within the endTime.  If endTime is negative then only a single
   * iteration is run.
   */
  step(timeDelta: Timestamp = -1, maxSteps = -1): number {
    // first ensure outputs are computed at this time
    const currTime = this.eventQueue.nextEventTime;
    const endTime = currTime + timeDelta;
    const simEndTime = Math.max(currTime, endTime);
    let count = 0;
    // The next event is the earliest one we can find so give it to
    // the actor that needs to handle it.
    while (this.stepNext() != null) {
      count++;
      if (timeDelta < 0 && maxSteps < 0) break;
      if (timeDelta > 0 && this.eventQueue.nextEventTime > simEndTime) break;
      if (maxSteps > 0 && count >= maxSteps) break;
    }
    return count;
  }

  /**
   * Steps exactly one message.
   */
  stepNext(): Nullable<Message | Interrupt> {
    const nextEvent = this.eventQueue.getNextMessage();
    if (nextEvent != null) {
      this._currTime = nextEvent.time;

      if (nextEvent.type == MessageType.INTERRUPT) {
        nextEvent.source.processInterrupt(nextEvent, this);
        this.interruptProcessed(nextEvent);
      } else {
        if (nextEvent.type == MessageType.SEND) {
          const send = nextEvent as Send;
          const nextActor = this.nextActorFor(send);
          nextActor.processSend(send, this);
          this.sendProcessed(send);
        } else {
          const reply = nextEvent as Reply;
          const nextActor = reply.nextActor || null;
          assert(nextActor != null, "Next actor *cannot* be null for a Reply");
          nextActor.processReply(reply, this);
          this.replyProcessed(reply);
        }
      }
    }
    return nextEvent;
  }

  nextActorFor(event: Send): Actor {
    if (event.nextActor != null) {
      return event.nextActor;
    }
    let nextActor = null;
    if (event.nextActorName != null) {
      nextActor = event.source.nextActorByName(event.nextActorName, event.source);
    } else {
      nextActor = event.source.nextActorForAddress(event.address, event.source);
    }
    if (nextActor == null) {
      assert(
        false,
        `Cannot find nextActor by name (${event.nextActorName}) or by address (${event.address.dest}, ${event.address.method})`,
      );
    }
    event.setNextActor(nextActor);
    return nextActor;
  }

  interruptProcessed(_interrupt: Interrupt): void {
    // override this
  }

  inject(message: Message): void {
    this.eventQueue.inject(message);
  }

  requestInterruptIn(source: Actor, deltaTime: number): Interrupt {
    const atTime = deltaTime + this.currTime;
    const interrupt = new Interrupt(source, atTime);
    this.eventQueue.injectInterrupt(interrupt);
    return interrupt;
  }
}
