import { Actor } from "../base";
import { Generator } from "../generator";
import { Network } from "../network";
import { MessageType, Interrupt } from "../message";
import { ONE_SEC } from "../../utils/timeutils";
import { TestSimulator } from "./mocks";

class TestActor extends Actor {}

describe("Generator Tests", () => {
  test("Basic Tests", () => {
    const gen = new Generator("g1");
    gen.add("t1", "m1", 10);
    gen.add("t2", "m2", 20);
    expect(gen.totalWeight).toBe(30);
    expect(gen.destCount).toBe(2);
    expect(gen.destAt(0).dest).toBe("t1");
    expect(gen.destAt(0).method).toBe("m1");
    expect(gen.destAt(0).weight).toBe(10);
    expect(gen.destAt(1).dest).toBe("t2");
    expect(gen.destAt(1).method).toBe("m2");
    expect(gen.destAt(1).weight).toBe(20);
  });

  test("Clone Tests", () => {
    const gen = new Generator("g1");
    gen.add("t1", "m1", 10);
    gen.add("t2", "m2", 20);

    const g2 = gen.clone("g2");
    expect(g2.totalWeight).toBe(30);
    expect(g2.destCount).toBe(2);
    expect(g2.destAt(0).dest).toBe("t1");
    expect(g2.destAt(0).method).toBe("m1");
    expect(g2.destAt(0).weight).toBe(10);
    expect(g2.destAt(1).dest).toBe("t2");
    expect(g2.destAt(1).method).toBe("m2");
    expect(g2.destAt(1).weight).toBe(20);
  });

  test("Ramp Tests", () => {
    const gen = new Generator("g1");
    gen.targetQPS = 100;
    expect(gen.deltaQPS).toBe(9.9);
    expect(gen.currentQPS).toBe(1);

    gen.currentQPS = 100;
    gen.targetQPS = 1;
    expect(gen.deltaQPS).toBe(-9.9);
    gen.currentQPS = 1;
  });

  test("Generator start and stop", () => {
    const world = new TestSimulator();
    const gen = new Generator("g1");
    gen.start(world);
    expect(gen.started).toBe(true);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.INTERRUPT);

    gen.stop();
    expect(gen.started).toBe(false);

    gen.reset();
    expect(gen.started).toBe(false);
  });

  test("Generator processReply", () => {
    let world = new TestSimulator();
    const net1 = new Network("n1");
    const gen = new Generator("g1");
    const t1 = new TestActor("t1");
    const t2 = new TestActor("t2");
    const t3 = new TestActor("t3");
    const t4 = new TestActor("t4");
    gen.add("t1", "m1", 10);
    gen.add("t2", "m2", 20);
    gen.add("t3", "m3", 30);
    gen.add("t4", "m4", 40);
    gen.targetQPS = 10;
    gen.start(world);
    expect(gen.started).toBe(true);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.INTERRUPT);

    net1.add(gen);
    net1.add(t1);
    net1.add(t2);
    net1.add(t3);
    net1.add(t4);

    world = new TestSimulator();
    expect(gen.round).toBe(0);
    const int1 = new Interrupt(gen, ONE_SEC);
    gen.processInterrupt(int1, world);
  });
});
