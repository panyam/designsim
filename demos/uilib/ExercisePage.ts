import "../global/styles/common";
import "../global/styles/code";
import { loadExercise } from "./exerciseml";
import { commonInit } from "../global/src/index";
import { Exercise } from "./Exercise";
import ExerciseView from "./ExerciseView";
import { removeNode, insertAfter, setAttr, createNode } from "../../src/utils/dom";

commonInit();

export default class ExercisePage {
  exercises: { [key: string]: Exercise } = {};
  viewForExercises: { [key: string]: ExerciseView } = {};

  constructor() {
    // const excElems = document.querySelectorAll(".exerciseContainerDiv");
    const excElems = document.querySelectorAll("exercise");
    excElems.forEach((elem) => this.createExerciseView(elem));
  }

  getExercise(name: string): Exercise {
    return this.exercises[name];
  }

  createExerciseView(excElem: Element): ExerciseView {
    const [excDivElem, exercise] = this.createDivAndExercise(excElem);
    const out = new ExerciseView(excDivElem, exercise);
    this.exercises[excElem.id] = exercise;
    this.viewForExercises[excElem.id] = out;
    return out;
  }

  createDivAndExercise(excElem: Element): [HTMLDivElement, Exercise] {
    if (excElem.id in this.exercises) {
      throw new Error("Duplicate Instance of exercise: " + excElem.id);
    }

    const excDivElem = createNode(document, "div");
    insertAfter(excElem, excDivElem);
    removeNode(excElem);

    // copy key attributes to div
    for (let i = 0; i < excElem.attributes.length; i++) {
      const nattr = excElem.attributes.item(i);
      if (nattr != null) {
        setAttr(excDivElem, nattr.name, nattr.value);
        console.log("X: ", nattr);
      }
    }

    const shapeFactory = null; // new DefaultShapeFactory(document);
    const exercise = new Exercise(shapeFactory);
    const methodAttr = excElem.getAttribute("method") || null;
    if (methodAttr != null) {
      const method = (window as any)[methodAttr];
      method(exercise);
    } else {
      loadExercise(exercise, excElem);
    }
    return [excDivElem, exercise];
  }

  handlePropertyChange(exercise: Exercise, name: string, value: number): void {
    throw new Error("Custom Property Change not implemented: " + name);
  }
}
