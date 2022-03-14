import { System } from "../src/basic/base";
import { DBServer } from "../src/basic/component/storage/dbserver";
import { Disk } from "../src/basic/component/storage/disk";
import { LoadBalancer } from "../src/basic/component/loadbalancer";
import { Busy } from "../src/basic/instruction/busy";
import { Forward } from "../src/basic/instruction/forward";

describe("Create System with 5 Disks", () => {
  test("shoule create System with 5 Disks", () => {
    // Step 1 - Declare the System

    // Empty System
    const DBSystem = new System("FullDB");

    // Add the first component to our system
    const l1lb = new LoadBalancer("l1lb");
    DBSystem.add(l1lb);

    //
    const l2lb = new LoadBalancer("l2lb");
    DBSystem.add(l2lb);

    const dbserver = new DBServer("dbserver");
    DBSystem.add(dbserver);

    // Option 1
    DBSystem.on("*", new Forward("l1lb"));

    // Option 2
    // DBSystem.entry(l1lb);

    l1lb.on("*", new Forward("l2lb"));
    l2lb.on("*", new Forward("dbserver"));

    dbserver.on("del", new Busy(50));

    // DBSystem is now an "available" blueprint of a system it
    // needs to be instantiated
    // const instance1 = DBSystem.clone("instance1");
  });
});
