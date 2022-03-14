import * as fs from "fs";
import * as path from "path";
import { Nullable } from "../../types";
import { loadFromPath } from "./utils";
import { TestSimulator } from "../../actors/tests/mocks";
import { Actor, System } from "../../actors/base";
import { Generator } from "../../actors/generator";
import { assert } from "../../utils/misc";
import { actorByPath } from "../../actors/utils";
import { ONE_SEC } from "../../utils/timeutils";

const TEN_SECONDS = 10 * ONE_SEC;

export class Harness {
  simulator: TestSimulator;
  system: System;
  generators: Generator[] = [];

  constructor(systemPath: string, dirname: string | undefined) {
    this.simulator = new TestSimulator();

    if (dirname) {
      systemPath = path.resolve(dirname, systemPath);
    }
    const system = loadFromPath(systemPath);
    assert(system != null, "Invalid system");
    this.system = system as System;

    // Collect all generators
    Actor.visit(system, (actor) => {
      if (actor instanceof Generator) {
        this.generators.push(actor);
      }
    });
    if (this.generators.length == 0) {
      console.log("No generators found");
    }
  }

  reset(): void {
    this.simulator.reset();
  }

  start(): void {
    this.generators.forEach((actor) => actor.start(this.simulator));
  }

  step(timeDelta: number = TEN_SECONDS): number {
    return this.simulator.step(timeDelta);
  }

  actorByPath(path: string): Nullable<Actor> {
    return actorByPath(this.system, path.split("."));
  }
}
