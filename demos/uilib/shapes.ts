import { Nullable } from "../../src/types";
import { Actor, System, OrderedSystem } from "../../src/actors/base";
import { Network } from "../../src/actors/network";
import { createNode } from "../../src/utils/dom";
import { Busy } from "../../src/actors/busy";
import { Call } from "../../src/actors/call";
import { Router } from "../../src/actors/router";
import { DBNode } from "../../src/actors/dbnode";
import { Series } from "../../src/actors/series";
import { Parallel } from "../../src/actors/parallel";
import { Generator } from "../../src/actors/generator";
import { Decorator } from "../../src/actors/decorator";
import { Queue } from "../../src/actors/queue";
import { Timeout } from "../../src/actors/timeout";
import { LoadBalancer } from "../../src/actors/loadbalancer";
import { actorByPath } from "../../src/actors/utils";
import { getAttr, setAttr } from "../../src/utils/dom";

export interface ShapeFactory {
  createSVGNode<T extends SVGGraphicsElement>(nodename: string, attrs?: any, text?: string): T;
  svgElementFor(entity: Actor, nodeType: string): SVGGraphicsElement;
  shapeForActor(entity: Actor): Shape;
  actorForElement(element: Element): Nullable<Actor>;
}

/**
 * Shapes are renderer and controllers for Actors when shown on our Designer.
 * We need a way to manipulate the Actors, control how they are viewed,
 * transformed, etc and a Shape is the interface to make that happen.
 */
export abstract class Shape {
  actor: Actor;
  protected showHeading = true;
  protected headingView: Nullable<SVGGraphicsElement>;
  protected headingBG: SVGRectElement;
  protected headingText: SVGTextElement;
  protected headingHeight = 0;
  protected headingWidth = 0;
  protected borderWidth = 2;
  protected showBG = true;
  protected bgView: Nullable<SVGGraphicsElement>;
  protected paddingWidth = 10;
  protected prefWidth = -1;
  protected prefHeight = -1;
  private _viewRoot: Nullable<SVGGraphicsElement> = null;
  protected shapeFactory: ShapeFactory;
  protected minChildX = 0;
  protected minChildY = 0;
  protected maxChildX = -1e25;
  protected maxChildY = -1e25;
  protected maxChildWidth = 0;
  protected maxChildHeight = 0;

  constructor(actor: Actor, shapeFactory: ShapeFactory) {
    this.actor = actor;
    this.shapeFactory = shapeFactory;
  }

  /**
   * Renders the actor and returns an SVGGraphicsElement corresponding to this actor.
   */
  viewRoot(parent: SVGGraphicsElement): SVGGraphicsElement {
    if (this._viewRoot == null) {
      this._viewRoot = this.createViewRoot(parent);
    }
    return this._viewRoot;
  }

  get preferredHeight() {
    return this.prefHeight;
  }
  get preferredWidth() {
    return this.prefWidth;
  }

  get viewParams(): any {
    return (this.actor as any).viewParams;
  }

  /**
   * Creates a new SVG View root for this actor.
   * Also this method is responsible for calculating the preferred sizes
   * so it can be used in layout calculations by parents.
   */
  protected createViewRoot(parent: SVGGraphicsElement): SVGGraphicsElement {
    const root = this.createRootElement();
    root.classList.add(this.constructor.name);
    parent.appendChild(root);

    if (this.showHeading) {
      this.headingView = this.createHeadingView(root);
    }

    // Create background elements
    if (this.showBG) {
      this.bgView = this.createBGView(root);
      if (this.bgView != null) {
        this.bgView.classList.add(this.constructor.name + "_BGView");
      }
    }

    // Create the children
    this.createChildViews(root);

    // Set the padding sizes since children are all laid out now.
    this.refreshLayout(parent);
    return root;
  }

  protected createHeadingView(parent: SVGGraphicsElement): SVGGraphicsElement | null {
    const sf = this.shapeFactory;
    const headingView = (this.headingView = sf.createSVGNode("g", {
      x: 0,
      y: 0,
      class: "actorHeadingView",
      style: "stroke:rgb(255,0,0);stroke-width: 2; fill: rgb(255,255,0)",
    }));
    parent.appendChild(headingView);

    const headingBG = (this.headingBG = sf.createSVGNode("rect", {
      x: 0,
      y: 0,
      class: "networkActorHeading",
      style: "stroke:rgb(255,0,0);stroke-width: 2; fill: rgb(255,255,0)",
    }));

    const headingText = (this.headingText = sf.createSVGNode("text", { class: "callActorHeading" }, this.actor.name));

    headingView.appendChild(headingBG);
    headingView.appendChild(headingText);

    const bw = this.paddingWidth;
    const headingBBox = headingText.getBBox();
    this.prefHeight = this.headingHeight = headingBBox.height + bw + bw;
    this.headingWidth = headingBBox.width;
    this.prefWidth = this.headingWidth + bw + bw;

    return headingView;
  }

  protected createBGView(parent: SVGGraphicsElement): SVGGraphicsElement | null {
    const bgView = this.shapeFactory.createSVGNode("rect", {
      x: 0,
      y: 0,
      class: "actorBorderBG",
      fill: "none",
      stroke: "black",
      "stroke-width": this.borderWidth,
    });
    parent.appendChild(bgView);
    return bgView;
  }

  protected createRootElement(): SVGGraphicsElement {
    return this.shapeFactory.svgElementFor(this.actor, "svg");
  }

  protected createChildViews(_parent: SVGGraphicsElement): void {
    // do nothing.  let children implement this
  }

  refreshLayout(_root: SVGGraphicsElement): void {
    const bw = this.paddingWidth;
    if (this.headingView != null) {
      setAttr(this.headingView, "x", 0);
      setAttr(this.headingView, "y", 0);
      setAttr(this.headingView, "width", this.headingWidth);
      setAttr(this.headingView, "height", this.headingHeight);

      setAttr(this.headingBG, "width", this.prefWidth);
      setAttr(this.headingBG, "height", this.headingHeight);
      setAttr(this.headingText, "y", this.headingHeight - bw);
      setAttr(this.headingText, "x", (this.prefWidth - this.headingWidth) / 2);
    }
    if (this.bgView != null) {
      setAttr(this.bgView, "x", 0);
      setAttr(this.bgView, "y", 0);
      setAttr(this.bgView, "width", this.prefWidth);
      setAttr(this.bgView, "height", this.prefHeight);
    }
  }
}

export abstract class SystemShape extends Shape {
  bboxes: SVGRect[] = [];

  constructor(actor: System, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.showBG = this.actor.parent != null && (this.actor as System).childCount > 1;
    this.showHeading = this.actor.parent != null && (this.actor as System).childCount > 1;
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as System;
    const sf = this.shapeFactory;

    this.maxChildWidth = 0;
    this.maxChildHeight = 0;

    for (const child of actor.getChildren()) {
      // create an SVG for the child so it can draw on to it
      const shape = sf.shapeForActor(child);
      const viewRoot = shape.viewRoot(parent);
      parent.appendChild(viewRoot);
      const bbox = viewRoot.getBBox();
      this.bboxes.push(bbox);
      this.maxChildWidth = Math.max(this.maxChildWidth, bbox.width);
      this.maxChildHeight = Math.max(this.maxChildHeight, bbox.height);
    }

    this.prefWidth = this.maxChildWidth + this.paddingWidth * 2;
    this.prefHeight = this.maxChildHeight + this.paddingWidth * 2;
  }
}

export class DecoratorShape extends SystemShape {
  borderStrokeColor = "yellow";
  constructor(actor: Decorator, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.showBG = true;
    this.showHeading = false;
  }

  protected createBGView(parent: SVGGraphicsElement): SVGGraphicsElement | null {
    const bgView = this.shapeFactory.createSVGNode("rect", {
      x: 0,
      y: 0,
      class: "actorBorderBG",
      fill: "none",
      stroke: this.borderStrokeColor,
      "stroke-width": this.borderWidth,
    });
    parent.appendChild(bgView);
    return bgView;
  }

  refreshLayout(parent: SVGGraphicsElement) {
    super.refreshLayout(parent);
    const actor = this.actor as Decorator;
    const child = actor.target!;
    const sf = this.shapeFactory;
    const paddingWidth = this.paddingWidth;

    const shape = sf.shapeForActor(child);
    const childViewRoot = shape.viewRoot(parent);
    setAttr(childViewRoot, "x", paddingWidth);
    setAttr(childViewRoot, "y", paddingWidth);
  }
}

export abstract class OrderedSystemShape extends Shape {
  horizLayout = true;

  constructor(actor: OrderedSystem, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as System;
    const sf = this.shapeFactory;
    const bw = this.paddingWidth;

    let totalWidth = 0;
    let totalHeight = 0;
    this.maxChildWidth = 0;
    this.maxChildHeight = 0;

    for (const child of actor.getChildren()) {
      // create an SVG for the child so it can draw on to it
      const shape = sf.shapeForActor(child);
      const childViewRoot = shape.viewRoot(parent);
      parent.appendChild(childViewRoot);
      const bbox = childViewRoot.getBBox();
      this.maxChildWidth = Math.max(this.maxChildWidth, bbox.width);
      this.maxChildHeight = Math.max(this.maxChildHeight, bbox.height);
      totalWidth += bbox.width;
      totalHeight += bbox.height;
    }

    if (this.horizLayout) {
      this.prefWidth = totalWidth + actor.childCount * bw + bw;
      this.prefHeight = bw + bw + this.maxChildHeight;
    } else {
      this.prefWidth = bw + bw + this.maxChildWidth;
      this.prefHeight = totalHeight + actor.childCount * bw + bw;
    }
    if (this.showHeading) this.prefHeight += this.headingHeight;
  }

  refreshLayout(parent: SVGGraphicsElement) {
    super.refreshLayout(parent);
    const sf = this.shapeFactory;
    const bw = this.paddingWidth;
    const actor = this.actor as OrderedSystem;

    let currX = bw;
    let currY = bw;
    if (this.showHeading) currY += this.headingHeight;

    for (const child of actor.getChildren()) {
      const shape = sf.shapeForActor(child);
      const childViewRoot = shape.viewRoot(parent);
      const bbox = childViewRoot.getBBox();
      setAttr(childViewRoot, "x", currX);
      setAttr(childViewRoot, "y", currY);
      if (this.horizLayout) currX += bbox.width + bw;
      else currY += bbox.height + bw;
    }
  }
}

export class NetworkShape extends SystemShape {
  constructor(actor: Network, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    super.createChildViews(parent);
    const bw = this.paddingWidth;
    const actor = this.actor as System;
    const sf = this.shapeFactory;

    // Network layout is simple - just absolute layout by moving
    // to right location
    this.minChildX = 1e25;
    this.minChildY = 1e25;
    this.maxChildX = -1e25;
    this.maxChildY = -1e25;
    for (const child of actor.getChildren()) {
      const shape = sf.shapeForActor(child);
      shape.viewRoot(parent);
      const childVP = shape.viewParams;
      const childWidth = shape.preferredWidth;
      const childHeight = shape.preferredHeight;

      this.minChildX = Math.min(this.minChildX, childVP.x);
      this.minChildY = Math.min(this.minChildY, childVP.y);
      this.maxChildX = Math.max(this.maxChildX, childVP.x + childWidth);
      this.maxChildY = Math.max(this.maxChildY, childVP.y + childHeight);
    }

    this.prefWidth = this.maxChildX + bw + bw;
    this.prefHeight = this.maxChildY + bw + bw + this.headingHeight;
  }

  refreshLayout(parent: SVGGraphicsElement) {
    super.refreshLayout(parent);
    const bw = this.paddingWidth;
    const actor = this.actor as System;
    const sf = this.shapeFactory;
    for (const child of actor.getChildren()) {
      const shape = sf.shapeForActor(child);
      const childViewRoot = shape.viewRoot(parent);
      const childVP = shape.viewParams;
      const newX = childVP.x + bw;
      const newY = childVP.y + bw + this.headingHeight;
      setAttr(childViewRoot, "x", newX);
      setAttr(childViewRoot, "y", newY);
    }
  }
}

export class SeriesShape extends OrderedSystemShape {
  constructor(actor: Series, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }
}

export class ParallelShape extends OrderedSystemShape {
  constructor(actor: Parallel, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }
}

export class BusyShape extends Shape {
  constructor(actor: Busy, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }

  protected createRootElement() {
    return this.shapeFactory.createSVGNode("text", {}, `Busy({$this.actor.waitTime})`);
  }
}

export class CallShape extends Shape {
  targetText: SVGTextElement;
  methodText: SVGTextElement;
  seperator: SVGLineElement;
  targetBBox: SVGRect;
  methodBBox: SVGRect;

  constructor(actor: Call, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as Call;
    const sf = this.shapeFactory;

    const targetText = (this.targetText = sf.createSVGNode("text", { class: "callActorTarget" }, actor.address.dest));
    const methodText = (this.methodText = sf.createSVGNode("text", { class: "callActorTarget" }, actor.address.method));
    const seperator = (this.seperator = sf.createSVGNode("line", {
      x: 0,
      class: "callActorTarget",
      style: "stroke:rgb(255,0,0);stroke-width: 2",
    }));
    parent.appendChild(targetText);
    parent.appendChild(seperator);
    parent.appendChild(methodText);

    const targetBBox = (this.targetBBox = targetText.getBBox());
    const methodBBox = (this.methodBBox = methodText.getBBox());

    const maxWidth = Math.max(this.headingWidth, targetBBox.width, methodBBox.width);
    const totalHeight = this.headingHeight + targetBBox.height + methodBBox.height;

    const bw = this.paddingWidth;
    this.prefWidth = maxWidth + bw + bw;
    this.prefHeight = totalHeight + bw;
  }

  refreshLayout(parent: SVGGraphicsElement) {
    super.refreshLayout(parent);
    const bw = this.paddingWidth;

    // Now laythem all out.
    const maxWidth = Math.max(this.headingWidth, this.targetBBox.width, this.methodBBox.width);

    setAttr(this.targetText, "x", bw + (maxWidth - this.targetBBox.width) / 2);
    setAttr(this.targetText, "y", this.headingHeight + this.targetBBox.height);
    setAttr(this.methodText, "x", bw + (maxWidth - this.methodBBox.width) / 2);
    setAttr(this.methodText, "y", this.headingHeight + this.targetBBox.height + this.methodBBox.height);

    setAttr(this.seperator, "y", this.headingHeight + this.targetBBox.height);
  }
}

export class RouterShape extends NetworkShape {
  nameText: SVGTextElement;

  constructor(actor: Router, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }
}

export class DBNodeShape extends Shape {
  nameText: SVGTextElement;

  constructor(actor: DBNode, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.showHeading = false;
  }

  protected createBGView(parent: SVGGraphicsElement): SVGGraphicsElement | null {
    return null;
  }

  protected createRootElement() {
    return this.shapeFactory.svgElementFor(this.actor, "g");
  }

  topEllipse: SVGEllipseElement;
  bottomArc: SVGPathElement;

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as DBNode;
    const sf = this.shapeFactory;

    const paddingWidth = this.paddingWidth;
    const nameText = (this.nameText = sf.createSVGNode("text", { class: "dbnodeActorTarget" }, actor.name));
    parent.appendChild(nameText);

    const nameBBox = nameText.getBBox();

    const bw2 = paddingWidth + paddingWidth;
    const maxWidth = nameBBox.width + bw2;

    const cx = maxWidth / 2;
    const cy = 10;
    const lineLength = cy + cy + nameBBox.height + paddingWidth;
    const topEllipse = (this.topEllipse = sf.createSVGNode("ellipse", {
      rx: cx,
      ry: cy,
      cx: this.borderWidth + cx,
      cy: this.borderWidth + cy,
      fill: "none",
      stroke: "black",
      "stroke-width": this.borderWidth,
    }));
    parent.insertBefore(topEllipse, nameText);

    const bottomArc = (this.bottomArc = sf.createSVGNode("path", {
      d: `
      M ${this.borderWidth} ${cy}
      v ${lineLength}
      A ${cx} ${cy} 0 0 0 ${maxWidth + this.borderWidth} ${cy + lineLength}
      v -${lineLength}
      `,
      stroke: "black",
      fill: "none",
      "stroke-width": this.borderWidth,
    }));
    parent.insertBefore(bottomArc, nameText);

    // Now they all out.
    setAttr(nameText, "x", this.borderWidth + (maxWidth - nameBBox.width) / 2);
    setAttr(nameText, "y", 5 + cy + cy + nameBBox.height);

    const totalHeight = nameBBox.height + cy + cy + cy;
    this.prefWidth = maxWidth + this.borderWidth * 2;
    this.prefHeight = totalHeight + this.paddingWidth * 2;
  }
}

export class LoadBalancerShape extends Shape {
  nameText: SVGTextElement;

  constructor(actor: LoadBalancer, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as LoadBalancer;
    const sf = this.shapeFactory;

    const paddingWidth = this.paddingWidth;
    const nameText = (this.nameText = sf.createSVGNode("text", { class: "dbnodeActorTarget" }, actor.name));
    parent.appendChild(nameText);

    const headingBBox = this.headingText.getBBox();
    const nameBBox = nameText.getBBox();

    const maxWidth = Math.max(headingBBox.width, nameBBox.width);
    const totalHeight = headingBBox.height + nameBBox.height;

    const bw2 = paddingWidth + paddingWidth;

    // Now they all out.
    setAttr(nameText, "y", bw2 + paddingWidth + headingBBox.height + nameBBox.height);

    setAttr(nameText, "x", paddingWidth + (maxWidth - nameBBox.width) / 2);

    this.prefWidth = maxWidth + this.paddingWidth * 2;
    this.prefHeight = totalHeight + this.paddingWidth * 4;
  }
}

export class GeneratorShape extends Shape {
  nameText: SVGTextElement;
  nameBBox: SVGRect;

  constructor(actor: Generator, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.showHeading = false;
  }

  refreshLayout(parent: SVGGraphicsElement) {
    super.refreshLayout(parent);

    const paddingWidth = this.paddingWidth;
    setAttr(this.nameText, "y", paddingWidth + this.nameBBox.height);
    setAttr(this.nameText, "x", paddingWidth);
  }

  protected createChildViews(parent: SVGGraphicsElement): void {
    const actor = this.actor as Generator;
    const sf = this.shapeFactory;

    const nameText = (this.nameText = sf.createSVGNode("text", { class: "generatorActorTarget" }, actor.name));
    parent.appendChild(nameText);

    const nameBBox = (this.nameBBox = nameText.getBBox());

    const maxWidth = nameBBox.width;
    const totalHeight = nameBBox.height;

    // Now they all out.
    this.prefWidth = maxWidth + this.paddingWidth * 2;
    this.prefHeight = totalHeight + this.paddingWidth * 2;
  }
}

export class QueueShape extends DecoratorShape {
  constructor(actor: Queue, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.showHeading = false;
    this.paddingWidth = 10;
    this.borderWidth = 10;
  }
}

export class TimeoutShape extends DecoratorShape {
  constructor(actor: Timeout, shapeFactory: ShapeFactory) {
    super(actor, shapeFactory);
    this.borderStrokeColor = "purple";
    this.showHeading = false;
    this.paddingWidth = 10;
    this.borderWidth = 10;
  }
}

/**
 * Scenes are those that draw "anything" to represent an element
 * (and * all its children.  This is like a "fallthrough" where
 * we can use a very rich graphic to represent an actor.
 */
export class Scene extends Shape {
  private svgElement: SVGGraphicsElement;
  private actorsByPath: any = {};

  constructor(svgElement: SVGGraphicsElement, actor: Actor, shapeFactory: Nullable<ShapeFactory> = null) {
    super(actor, shapeFactory!);
    this.svgElement = svgElement;
    this.showBG = false;
    this.showHeading = false;

    // go through the svg
    const selectors = this.svgElement.querySelectorAll("[actorPath]");
    selectors.forEach((elem) => {
      const actorPath = getAttr(elem, "actorpath") || "";
      console.log("Elem: ", elem);
      const curr = actorByPath(this.actor, actorPath.split("."));
      if (curr != null) {
        this.actorsByPath[actorPath] = curr;
      }
    });
  }

  /**
   * Creates a new SVG View root for this actor.
   * Also this method is responsible for calculating the preferred sizes
   * so it can be used in layout calculations by parents.
   */
  protected createRootElement(): SVGGraphicsElement {
    // Recurse into this element and find all entries which have an
    // actorPath field
    return this.svgElement;
  }

  actorForElement(element: Element): Nullable<Actor> {
    let curr: Nullable<Element> = element;
    while (curr != null) {
      const actorPath = getAttr(curr, "actorpath") || "";
      if (actorPath in this.actorsByPath) {
        return this.actorsByPath[actorPath];
      }
      curr = curr.parentElement;
    }
    return null;
  }
}

export class DefaultShapeFactory implements ShapeFactory {
  ownerDoc: Document;
  shapes: { [key: number]: Shape } = {};
  containers: { [key: number]: SVGGraphicsElement } = {};
  actorsByContainerId = {} as { [key: string]: Actor };

  constructor(doc: Document) {
    this.ownerDoc = doc;
  }

  actorForElement(element: Element): Nullable<Actor> {
    let curr = element;
    do {
      const actor = this.actorsByContainerId[curr.id] || null;
      if (actor != null) return actor;
      if (curr.parentElement == null) return null;
      curr = curr.parentElement;
    } while (true);
  }

  reset() {
    this.shapes = {};
    this.containers = {};
  }

  createSVGNode<T extends SVGGraphicsElement>(nodename: string, attrs?: any, text?: string): T {
    return createNode(this.ownerDoc, nodename, "http://www.w3.org/2000/svg", attrs, text) as T;
  }

  svgElementFor(entity: Actor): SVGGraphicsElement {
    if (!(entity.uuid in this.containers)) {
      const containerId = "actor" + entity.uuid;
      const container = (this.containers[entity.uuid] = this.createSVGNode("svg", {
        id: containerId,
        actorName: entity.name,
      }));
      this.actorsByContainerId[containerId] = entity;
    }
    return this.containers[entity.uuid];
  }

  shapeForActor(actor: Actor): Shape {
    if (!(actor.uuid in this.shapes)) {
      let shape: Shape;
      if (actor instanceof Network) {
        shape = new NetworkShape(actor, this);
      } else if (actor instanceof Busy) {
        shape = new BusyShape(actor, this);
      } else if (actor instanceof Call) {
        shape = new CallShape(actor, this);
      } else if (actor instanceof Router) {
        shape = new RouterShape(actor, this);
      } else if (actor instanceof DBNode) {
        shape = new DBNodeShape(actor, this);
      } else if (actor instanceof LoadBalancer) {
        shape = new LoadBalancerShape(actor, this);
      } else if (actor instanceof Series) {
        shape = new SeriesShape(actor, this);
      } else if (actor instanceof Parallel) {
        shape = new ParallelShape(actor, this);
      } else if (actor instanceof Generator) {
        shape = new GeneratorShape(actor, this);
      } else if (actor instanceof Queue) {
        shape = new QueueShape(actor, this);
      } else if (actor instanceof Timeout) {
        shape = new TimeoutShape(actor, this);
      } else {
        throw new Error("Actor not supported");
      }
      this.shapes[actor.uuid] = shape;
    }
    return this.shapes[actor.uuid];
  }
}
