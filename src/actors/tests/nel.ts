import { Address, Send, Interrupt } from "../message";
import { ReplyLogger } from "./mocks";
import { Moment } from "../nel";

describe("Moment Tests", () => {
  test("Basic Tests", () => {
    const moment = new Moment(10);
    const t1 = new ReplyLogger("t1");
    expect(moment.hasInterrupts).toBe(false);
    expect(moment.hasMessages).toBe(false);

    const int1 = new Interrupt(t1, 10);
    moment.addInterrupt(int1);
    expect(moment.hasInterrupts).toBe(true);
    expect(moment.hasMessages).toBe(false);

    expect(moment.popInterrupt()).toBe(int1);
    const send1 = new Send(t1, 0, new Address("a", "b"));
    moment.add(send1);
    expect(moment.hasInterrupts).toBe(false);
    expect(moment.hasMessages).toBe(true);

    expect(moment.popMessage()).toBe(send1);
    expect(moment.hasInterrupts).toBe(false);
    expect(moment.hasMessages).toBe(false);
  });
});
