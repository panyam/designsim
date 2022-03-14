import { PQ } from "../utils/pq/pq";
import { UUIDType, INFINITY, Nullable, Timestamp } from "../types";
import { Actor } from "./base";
import { Message, Interrupt } from "./message";
import { Comparator, LinkedList, PriorityQueue } from "typescriptcollectionsframework";

export interface NextEventList {
  inject(message: Message): void;
  injectInterrupt(interrupt: Interrupt): void;
  getNextMessage(): Nullable<Message | Interrupt>;
  clear(): void;
  isEmpty: boolean;
  /**
   * Returns the earliest time when the next event is scheduled.
   */
  nextEventTime: number;
}

class MessageComparator implements Comparator<Message | Interrupt> {
  compare(v2: Message | Interrupt, v1: Message | Interrupt): number {
    const delta = v2.time - v1.time;
    return delta == 0 ? v2.uuid - v1.uuid : delta;
  }
}

////////// Simple PQ based implementation
export class DefaultNextEventList implements NextEventList {
  interrupts = new PriorityQueue<Interrupt>(new MessageComparator());
  messages = new PriorityQueue<Message>(new MessageComparator());

  inject(message: Message): void {
    this.messages.offer(message);
  }

  injectInterrupt(interrupt: Interrupt): void {
    this.interrupts.offer(interrupt);
  }

  getNextMessage(): Nullable<Message | Interrupt> {
    const nextInt = this.interrupts.peek();
    const nextMsg = this.messages.peek();
    if (nextInt == null) {
      return this.messages.poll();
    }
    if (nextMsg == null) {
      return this.interrupts.poll();
    }
    if (nextInt.time <= nextMsg.time) {
      return this.interrupts.poll();
    } else {
      return this.messages.poll();
    }
  }

  clear(): void {
    this.interrupts.clear();
    this.messages.clear();
  }

  get isEmpty(): boolean {
    return this.interrupts.isEmpty() && this.messages.isEmpty();
  }

  /**
   * Returns the earliest time when the next event is scheduled.
   */
  get nextEventTime(): number {
    let out = INFINITY;
    if (!this.interrupts.isEmpty()) out = Math.min(out, this.interrupts.peek().time);
    if (!this.messages.isEmpty()) out = Math.min(out, this.messages.peek().time);
    return out;
  }
}

////////// A Moment + PQ List NEL implementation

export class Moment {
  // The time moment where all events are maintained
  time: Timestamp;

  // The events at this time
  eventList = new LinkedList<Message>();

  // Active actors in this moment
  activeActors = new Set<UUIDType>();

  // Set of interrupted actors - these are the unconditional events
  interruptedActors = new Set<UUIDType>();
  interrupts: Interrupt[] = [];

  constructor(time: Timestamp) {
    this.time = time;
  }

  get hasInterrupts(): boolean {
    return this.interrupts.length > 0;
  }

  get hasMessages(): boolean {
    return !this.eventList.isEmpty();
  }

  addInterrupt(interrupt: Interrupt): void {
    if (!this.interruptedActors.has(interrupt.uuid)) {
      this.interruptedActors.add(interrupt.uuid);
      this.interrupts.push(interrupt);
    }
  }

  /**
   * Add a new message into this moment.
   */
  add(message: Message): void {
    const sourceId = message.source.uuid;
    this.activeActors.add(sourceId);
    this.eventList.offerLast(message);
  }

  /**
   * Gets the next interrupt if any.
   */
  popInterrupt(): Nullable<Interrupt> {
    return this.interrupts.pop() || null;
  }

  /**
   * Gets the next event from our system if any events left.
   * otherwise returns null.
   */
  popMessage(): Message {
    return this.eventList.pollFirst();
  }
}

export class PQNextEventList implements NextEventList {
  eventQueue = new PQ<Moment>(
    (e1, e2) => e1.time - e2.time,
    (e1) => e1.time,
  );

  /**
   * Returns the earliest time when the next event is scheduled.
   */
  get nextEventTime(): number {
    if (this.eventQueue.isEmpty) return INFINITY;
    return this.eventQueue.top.value.time;
  }

  get isEmpty(): boolean {
    return this.eventQueue.isEmpty;
  }

  clear(): void {
    this.eventQueue.clear();
  }

  momentAtTime(time: number): Moment {
    if (time < this.nextEventTime && this.nextEventTime < INFINITY) {
      throw new Error("New message time in the past");
    }
    let handle = this.eventQueue.findByKey(time);
    if (handle == null) {
      handle = this.eventQueue.push(new Moment(time));
    }
    return handle.value;
  }

  /**
   * Injects a new message into our queue of messages.
   */
  inject(message: Message): void {
    const moment = this.momentAtTime(message.time);
    // Add the message into the event moment
    moment.add(message);
  }

  injectInterrupt(interrupt: Interrupt): void {
    const moment = this.momentAtTime(interrupt.time);
    // Add the interrupt into the event moment
    moment.addInterrupt(interrupt);
  }

  /**
   * Gets the next event from our system if any events left.
   * otherwise returns null.
   */
  getNextMessage(): Nullable<Message | Interrupt> {
    while (!this.eventQueue.isEmpty) {
      const nextMoment = this.eventQueue.top.value;
      if (nextMoment.hasInterrupts) {
        return nextMoment.popInterrupt();
      } else if (nextMoment.hasMessages) {
        return nextMoment.popMessage();
      } else {
        // nothing so remove the moment and go to next one
        this.eventQueue.pop();
      }
    }
    return null;
  }
}
