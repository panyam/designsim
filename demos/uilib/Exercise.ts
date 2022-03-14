import { assert } from "../../src/utils/misc";
import { Nullable } from "../../src/types";
import { Actor } from "../../src/actors/base";
import { Generator } from "../../src/actors/generator";
import { Simulator } from "../../src/actors/simulator";
import { Metrics } from "../../src/actors/collector";
import { Shape, ShapeFactory, DefaultShapeFactory, Scene } from "./shapes";
import { actorByPath } from "../../src/actors/utils";

export class ExerciseShapeFactory extends DefaultShapeFactory {
  createSVGNode<T extends SVGGraphicsElement>(nodename: string, attrs?: any, text?: string): T {
    const out = super.createSVGNode<T>(nodename, attrs, text);
    out.setAttribute("pointer-events", "all");
    return out;
  }
}

export type CustomPropertyChanged = (name: string, value: number) => boolean;

export class Exercise {
  name = "";
  shapeFactory: Nullable<ShapeFactory> = null;
  system: Nullable<Actor>;
  sceneSVG: Nullable<SVGGraphicsElement> = null;
  systemScene: Nullable<Scene> = null;
  customProperties = "";
  simulator: Simulator;
  generators: Generator[] = [];
  readonly allMetrics: Metrics[] = [];
  customPropertyChanged: CustomPropertyChanged;

  constructor(shapeFactory: Nullable<ShapeFactory> = null) {
    this.shapeFactory = shapeFactory;
    this.simulator = new Simulator();
  }

  addMetrics(metrics: Metrics): void {
    this.allMetrics.forEach((m) => {
      assert(m.name != metrics.name, "Duplicate metrics key found");
    });
    this.allMetrics.push(metrics);
  }

  getMetrics(name: string): Metrics {
    return this.allMetrics.filter((m) => m.name == name)[0];
  }

  reset(clearGenerators = false): void {
    this.simulator.reset();
    this.allMetrics.forEach((metrics) => metrics.reset());
    this.generators.forEach((gen) => gen.reset());
    if (clearGenerators) {
      this.generators = [];
    }
  }

  actorByPath(path: string): Nullable<Actor> {
    return actorByPath(this.system!, path.split("."));
  }

  setSystem(entity: Nullable<Actor>): void {
    console.log("new Actor = ", entity);
    this.reset(true);
    this.system = entity;
    if (entity != null) {
      // Collect all generators
      Actor.visit(entity, (actor) => {
        if (actor instanceof Generator) {
          this.generators.push(actor);
        }
      });
      if (this.generators.length == 0) {
        console.log("No generators found");
      }
    }
  }

  startClients(): void {
    this.generators.forEach((actor) => actor.start(this.simulator));
  }

  shapeForActor(entity: Actor): Shape {
    if (this.sceneSVG == null) {
      assert(this.shapeFactory != null, "ShapeFactory MUST be nonnull when scene is auto generated");
      return this.shapeFactory.shapeForActor(entity);
    } else {
      assert(entity == this.system, "Scene can only be invoked for root");
      if (this.systemScene == null) {
        this.systemScene = new Scene(this.sceneSVG, entity);
      }
      return this.systemScene;
    }
  }

  actorForElement(element: Element): Nullable<Actor> {
    if (this.systemScene == null) {
      assert(this.shapeFactory != null, "ShapeFactory MUST be nonnull when scene is auto generated");
      return this.shapeFactory.actorForElement(element);
    } else {
      return this.systemScene.actorForElement(element);
    }
  }
}
