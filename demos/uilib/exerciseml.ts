import { Exercise } from "./Exercise";
import { ModelLoader as DesignModelLoader } from "../../src/io/designml";
import { ensureAttr, getAttr } from "../../src/utils/dom";
import { StrToDuration } from "../../src/utils/timeutils";
import { Nullable } from "../../src/types";
import { Metrics, LatencyMetrics, CountMetrics } from "../../src/actors/collector";

export function loadExercise(exercise: Exercise, root: Element): void {
  // Our Exercise scheme contains the following:
  // 1. System - the current system being worked on.
  // 2. Scene - A visual/view representation of the System
  // 3. Metrics - List of Metrics we are interested in
  // 4. Properties - List of properties to be highlighted for this exercise
  const name = getAttr(root, "name") || null;
  if (name != null) exercise.name = name;

  const systemNode = root.querySelector("system");
  if (systemNode != null) {
    const designLoader = new DesignModelLoader();
    const result = designLoader.processElement(systemNode);
    result!.parent = null;
    exercise.setSystem(result);
  }

  // Now load the scene
  const sceneNode = root.querySelector("scene");
  if (sceneNode != null) {
    // See if there is a svg element inside this
    const sceneSVG = sceneNode.querySelector("svg") || null;
    exercise.sceneSVG = sceneSVG;
  }

  // Load fixed properties to be shown
  const propertiesNode = root.querySelector("properties");
  if (propertiesNode != null) {
    exercise.customProperties = propertiesNode.innerHTML;
  }

  // Now load fixed metrics to be shown
  const dashboardNode = root.querySelector("metricdashboard");
  if (dashboardNode != null) {
    for (let i = 0; i < dashboardNode.children.length; i++) {
      const child = dashboardNode.children[i];
      const tag = (child.tagName || "").toLowerCase();
      const name = ensureAttr(child, "name");
      const label = ensureAttr(child, "label");
      const windowSize = StrToDuration(getAttr(child, "window") || "1s");
      let metrics: Nullable<Metrics> = null;
      if (tag == "count") {
        metrics = new CountMetrics(name, label, windowSize);
      } else if (tag == "latency") {
        const percentile = parseFloat(getAttr(child, "pct") || "0.95");
        metrics = new LatencyMetrics(name, label, percentile, windowSize);
      }
      if (metrics != null) exercise.addMetrics(metrics);
    }
  }
}

/**
 * Utilities to load actors from a URL or an input stream.
 */
export function loadFromURL(exercise: Exercise, url: string, configs: any, callback: () => void): void {
  url = url.trim();
  const startTime = Date.now();
  $.get(url, function (data: any) {
    loadExercise(exercise, data.rootElement);
    const loadTime = Date.now() - startTime;
    console.log("Exercise loaded in: ", loadTime);
    callback();
  });
}

export function loadFromString(exercise: Exercise, input: string, configs: any = null): void {
  const domparser = new DOMParser();
  const doc = domparser.parseFromString(input, "text/xml");
  loadExercise(exercise, doc.documentElement);
}
