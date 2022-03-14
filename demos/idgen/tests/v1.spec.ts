import * as path from "path";
import { Address, Send } from "../../../src/actors/message";
import { SendEchoer, ReplyLogger } from "../../../src/actors/tests/mocks";
import { Harness } from "../../../src/io/tests/mocks";

import { JSDOM } from "jsdom";
global.DOMParser = new JSDOM().window.DOMParser;

const ONE_SEC = 1000000000;

describe("TinyURL Tests", () => {
  test("V1", () => {
    const v1 = new Harness("../exercises/v1/system.xml", __dirname);
    v1.reset();
    v1.generators[0].sendOneRound(v1.simulator);
    // v1.start();
    v1.step();
    console.log("Num Messages Processed: ", v1.simulator.processedMessages.length);
  });
});
