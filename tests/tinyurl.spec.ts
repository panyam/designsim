import { Callable, Link } from "../src/basic/base";
import { Request } from "../src/basic/request";
import { FullTinyURL, TinyURL } from "./samples";

describe("Create the Tinyurl System", () => {
  test("shoule create System with 5 Disks", () => {
    // Step 1 - Declare the System
    const TinyUrl = TinyURL();
    const getm = TinyUrl.getMetrics(new Request("resolve"));
    const putm = TinyUrl.getMetrics(new Request("create"));
    // console.log("GetMetrics: ", getm);
    // console.log("PutMetrics: ", putm);

    const tudb = TinyUrl.get("TUDB") as Callable;
    const link1 = TinyUrl.getConnection("TUWeb", "TUDB")?.link as Link;
    const linkmetrics = link1?.getMetrics();
    expect(getm.Latency).toBe(linkmetrics.Latency + tudb.getMetrics(new Request("get")).Latency);
  });

  test("Full tinyUrl", () => {
    // Step 1 - Declare the System
    const TUrl = FullTinyURL();
    const putm = TUrl.getMetrics(new Request("create"));
    // console.log("PutMetrics: ", putm);
  });

  test("Full tinyUrl clone", () => {
    // Step 1 - Declare the System
    const TUrl = FullTinyURL();
    const TUrl2 = TUrl.clone("t2");

    const putm2 = TUrl2.getMetrics(new Request("create"));
    const putm = TUrl.getMetrics(new Request("create"));
    // console.log("PutMetrics2: ", putm2);
    // console.log("PutMetrics: ", putm);
  });
});
