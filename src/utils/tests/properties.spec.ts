import { Link } from "../../basic/base";
import { Disk, DiskType } from "../../basic/component/storage/disk";
import { property, PropertyStore } from "../../utils/properties";

describe("test some properties", () => {
  test("should fail on no __properties__", () => {
    class A {
      @property()
      propA: string;
    }
    const a = new A();
    expect(a.propA).toBeUndefined();
    // expect(() => a.propA).toThrowError();
  });

  test("Extending should extend and override properties", () => {
    class A extends PropertyStore {
      @property({ defaultValue: "hello" })
      propA: string;
    }

    class B extends A {
      @property({ defaultValue: "world" })
      propA: string;

      @property({ defaultValue: "ola" })
      propB = "nola";
    }

    class C extends B {}

    const a = new A();
    expect(a.propA).toBe("hello");

    const b = new B();
    expect(b.propA).toBe("world");
    expect(b.propB).toBe("nola");

    const c = new C();
    expect(c.propA).toBe("world");
    expect(c.propB).toBe("nola");
  });

  test("Cloning should also clone property values", () => {
    const link1 = new Link("link1");
    link1.availability = 0.5;
    const link2 = link1.clone("link2");
    expect(link2.availability).toBe(0.5);
  });

  test("should get disk properties", () => {
    // Step 1 - Declare the System

    // Empty System
    const disk = new Disk("disk", DiskType.HDD);

    expect(disk.capacity).toBe(null);
    expect(disk.randomAccessLatency).toBe(10);
    expect(disk.failureRate).toBe(0.01);

    expect(disk.getProperty("capacity")!.value).toBe(null);
    expect(disk.getProperty("randomAccessLatency")!.value).toBe(10);
    expect(disk.getProperty("failureRate")!.value).toBe(0.01);

    expect(disk.getProperty("capacity")!.value).toBe(null);

    disk.setProperty("capacity", 5);
    expect(disk.getProperty("capacity")!.currentValue).toBe(5);

    expect(disk.getCapabilities()).not.toBe(null);
  });
});
