import { Actor, OrderedSystem } from "../base";
import { MessageType, Address, Send, Reply } from "../message";
import { Network } from "../network";
import { Busy } from "../busy";
import { SendEchoer, ReplyLogger, TestSimulator, MockSystem } from "./mocks";

describe("Actor Cloning Tests", () => {
  test("Test nextActorForAddress without parent", () => {
    const b1 = new Busy("b1");
    b1.setMetaData("life", 42);
    b1.waitTime = 999;
    const b2 = b1.clone("b2");
    expect(b2.name).toBe("b2");
    expect(b2.waitTime).toBe(999);
    expect(b1.getMetaData("life")).toBe(42);
  });

  test("SendAndReplies to fail by default", () => {
    const world = new TestSimulator();
    class TestActor extends Actor {}
    const t = new TestActor("test");
    const send = new Send(t, 0, new Address("a", "b")).setNextActor(new TestActor("test2"));
    expect(() => t.processSend(send, world)).toThrowError("Sends not allowed for this actor");
    const reply = send.spawnReply(0);
    expect(() => t.processReply(reply, world)).toThrowError("Replies not allowed for this actor");
  });

  test("Forward Sends and Replies", () => {
    const world = new TestSimulator();
    const net = new Network("net1");
    const t = new ReplyLogger("test");
    const t2 = new SendEchoer("test2");
    net.add(t);
    net.add(t2);
    const send = new Send(t, 0, new Address(t2.name, "b"));
    t.forwardSend(send, world);

    world.runTillEnd();
    expect(world.injectedMessages.length).toBe(2);

    world.expectProcessed(0, send);
    world.expectProcessed(1, {
      type: MessageType.REPLY,
      source: t2,
      nextActor: t,
      responseTo: send,
      isError: false,
    });
  });

  test("Forward Spawned Sends and Replies", () => {
    const world = new TestSimulator();
    class TestActor extends Actor {}
    const t = new TestActor("test");
    const t2 = new TestActor("test2");
    const t3 = new TestActor("test2");
    const send = new Send(t, 0, new Address("a", "b")).setNextActor(t2);
    const send2 = send.spawn(t2, 0).setNextActor(t3);
    t.forwardSend(send, world);
    t2.forwardSend(send2, world);
    expect(world.injectedMessages.length).toBe(2);
    expect(world.injectedMessages[0]).toBe(send);
    expect(world.injectedMessages[1]).toBe(send2);

    t3.replyToSend(send2, world);
    expect(world.injectedMessages.length).toBe(3);
    expect(world.injectedMessages[2].type).toBe(MessageType.REPLY);
    const reply1 = world.injectedMessages[2] as Reply;
    expect(reply1.responseTo).toBe(send2);
    expect(reply1.source).toBe(t3);
    expect(reply1.nextActor).toBe(t2);

    t2.forwardReply(reply1, world);
    expect(world.injectedMessages.length).toBe(4);
    expect(world.injectedMessages[3].type).toBe(MessageType.REPLY);
    const reply2 = world.injectedMessages[3] as Reply;
    expect(reply2.responseTo).toBe(send);
    expect(reply2.source).toBe(t2);
    expect(reply2.nextActor).toBe(t);
  });
});

describe("Common Actors Tests", () => {
  test("Test nextActorFor without parent", () => {
    const actor = new Busy("b1");
    expect(actor.nextActorForAddress(new Address("hello", "world"), actor)).toBe(null);
  });

  test("Test nextActorFor with parent", () => {
    const net = new Network("net1");
    const b1 = new Busy("b1");
    const b2 = new Busy("b2");
    net.add(b1);
    net.add(b2);
    expect(b1.nextActorByName("b2", b2)).toBe(b2);
  });

  test("Test Busy Actor processMessage", () => {
    const world = new TestSimulator();
    const source = new ReplyLogger("source");
    const actor = new Busy("b1");
    const net = new Network("net1");
    net.add(source);
    net.add(actor);

    const send = new Send(source, 10, new Address(actor.name, "*")).setNextActor(actor);
    actor.processSend(send, world);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.REPLY);
    expect(world.injectedMessages[0].source).toBe(actor);
    expect((world.injectedMessages[0] as Reply).nextActor).toBe(source);
    expect((world.injectedMessages[0] as Reply).responseTo).toBe(send);
  });
});

describe("System Tests", () => {
  test("System processSend", () => {
    const s1 = new MockSystem("s1");
    const child = new SendEchoer("child");
    child.parent = s1;
    const send1 = new Send(child, 0, new Address(s1.name, "b")).setNextActor(s1);

    let world = new TestSimulator();
    s1.processSend(send1, world);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.REPLY);
    expect(world.injectedMessages[0].source).toBe(s1);
    expect((world.injectedMessages[0] as Reply).isError).toBe(true);
    expect((world.injectedMessages[0] as Reply).errorReason).toBe("No destination found.");

    const outside = new ReplyLogger("outside");
    const send2 = new Send(outside, 0, new Address(s1.name, "b")).setNextActor(s1);
    world = new TestSimulator();
    s1.processSend(send2, world);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.REPLY);
    expect(world.injectedMessages[0].source).toBe(s1);
    expect((world.injectedMessages[0] as Reply).isError).toBe(true);
    expect((world.injectedMessages[0] as Reply).errorReason).toBe("No destination found.");
  });

  test("System processReply", () => {
    const s1 = new MockSystem("s1");
    const outside = new ReplyLogger("outside");
    const child = new SendEchoer("child");
    child.parent = s1;
    const send1 = new Send(outside, 0, new Address("a", "b")).setNextActor(s1);
    const send2 = send1.spawn(s1, 0).setNextActor(child);
    const reply = send2.spawnReply(0);

    const world = new TestSimulator();
    s1.processReply(reply, world);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.REPLY);
    expect(world.injectedMessages[0].source).toBe(s1);
    expect((world.injectedMessages[0] as Reply).isError).toBe(false);
    expect((world.injectedMessages[0] as Reply).nextActor).toBe(outside);
  });
});

describe("OrderedSystem Tests", () => {
  test("Basic Functions", () => {
    const s1 = new OrderedSystem("o1");
    class TestActor extends Actor {}
    const t1 = new TestActor("t1");
    const t2 = new TestActor("t2");
    const t3 = new TestActor("t3");
    s1.push(t1, t2, t3);

    expect(s1.childCount).toBe(3);
    expect(s1.get("t1")).toBe(t1);
    expect(s1.get("t2")).toBe(t2);
    expect(s1.get("t3")).toBe(t3);
    expect(s1.get("t4")).toBe(null);

    expect(s1.indexOf("t1")).toBe(0);
    expect(s1.indexOf("t2")).toBe(1);
    expect(s1.indexOf("t3")).toBe(2);

    expect(s1.indexOf(t1)).toBe(0);
    expect(s1.indexOf(t2)).toBe(1);
    expect(s1.indexOf(t3)).toBe(2);

    expect(s1.has("t1")).toBe(true);
    expect(s1.has("t2")).toBe(true);
    expect(s1.has("t3")).toBe(true);

    // Test cloning it
    const s2 = s1.clone("o2");
    expect(s2.childCount).toBe(3);

    expect(s2.indexOf("t1")).toBe(0);
    expect(s2.indexOf("t2")).toBe(1);
    expect(s2.indexOf("t3")).toBe(2);

    expect(s2.has("t1")).toBe(true);
    expect(s2.has("t2")).toBe(true);
    expect(s2.has("t3")).toBe(true);
  });
});
