import "./styles/ExerciseView";
import { Nullable } from "../../src/types";
import { Actor } from "../../src/actors/base";
import { Exercise } from "./Exercise";
import { Timer } from "./Timer";
import { View } from "./Views";
import { assert } from "../../src/utils/misc";
import { PropertiesView } from "./PropertiesView";
import { MetricsListView } from "./MetricsView";
import { ONE_SEC } from "../../src/utils/timeutils";

export default class ExerciseView extends View<Exercise> {
  systemRootSVG: SVGSVGElement;
  startStopButton: HTMLButtonElement;
  // contPauseButton: HTMLButtonElement;
  /*
  stepButton: HTMLButtonElement;
  stepDurationSelect: HTMLSelectElement;
  */

  propertiesDiv: HTMLDivElement;
  propertiesView: PropertiesView;

  metricsListDiv: HTMLDivElement;
  metricsListView: MetricsListView;

  systemContainerDiv: HTMLDivElement;
  metricsListTimer: Timer;
  simulationTimer: Timer;

  constructor(elem: Element, exercise: Exercise) {
    super(elem, "exercise", exercise);
  }

  get exercise(): Exercise {
    return this.entity!;
  }

  html(): string {
    return `
      <div class = "exerciseRowDiv">
        <div style="display: table-row">
          <div class = "systemDesignDiv">
            <div style="display: table; width: 100%">
              <div style="display: table-row; width: 100%">
                <div class = "propertiesDiv">Hello</div>
                <div class = "systemContainerDiv">
                  <svg class = "systemRootSVG" pointer-events = "all"></svg>
                </div>
                <div class = "metricsListDiv">Metrics Here</div>
            </div>
          </div>
        </div>
      </div>
      <div class = "exerciseRowDiv" class = "hidden">
        <div style="display: table-row; width: 100%">
          <div class = "exerciseButtonPanel">
            <button class = "startStopButton">Start</button>
            <!--
            <button disabled = "true" class = "contPauseButton">Continue</button>
            <button disabled = "true" class = "stepButton">Step</button>
            <select disabled = "true" class = "stepDurationSelect">
              <option value="1">1 Second</option>
              <option value="5">5 Seconds</option>
              <option value="10">10 Seconds</option>
              <option value="30">30 Seconds</option>
              <option value="60" selected="true">1 Minute</option>
            </select>
            -->
          </div>
        </div>
      </div>
    `;
  }

  setupViews(): void {
    super.setupViews();

    this.systemRootSVG = this.find(".systemRootSVG") as SVGSVGElement;
    this.systemRootSVG.addEventListener(
      "click",
      (event) => {
        const actor = this.exercise.actorForElement(event.target as Element);
        this.actorClicked(event, actor);
      },
      false,
    );

    this.systemContainerDiv = this.find(".systemContainerDiv") as HTMLDivElement;

    this.propertiesDiv = this.find(".propertiesDiv") as HTMLDivElement;
    this.propertiesDiv.innerHTML = this.exercise.customProperties;
    this.propertiesView = new PropertiesView(this.propertiesDiv, this.exercise);
    this.metricsListDiv = this.find(".metricsListDiv") as HTMLDivElement;
    this.metricsListView = new MetricsListView(this.metricsListDiv, this.exercise.simulator);
    this.metricsListView.entity = this.exercise.allMetrics;

    /*
    this.stepButton = this.find(".stepButton") as HTMLButtonElement;
    this.stepButton.addEventListener("click", () => {
      const timeDelta = parseInt(this.stepDurationSelect.value) * ONE_SEC;
      const startTime = performance.now();
      const count = this.exercise.simulator.step(timeDelta);
      const timetaken = performance.now() - startTime;
      console.log("Processed: ", count, timetaken, "ms");
    });
    this.stepDurationSelect = this.find(".stepDurationSelect") as HTMLSelectElement;

    this.contPauseButton = this.find(".contPauseButton") as HTMLButtonElement;
    this.contPauseButton.addEventListener("click", () => this.continueOrPauseSimulation());
   */

    this.startStopButton = this.find(".startStopButton") as HTMLButtonElement;
    this.startStopButton.addEventListener("click", () => this.startOrStopSimulation());

    this.systemRootSVG.textContent = "";
    const entityShape = this.exercise.shapeForActor(this.exercise.system!);
    assert(entityShape != null, "Unable to get shape for entity");
    entityShape.viewRoot(this.systemRootSVG);
    this.systemRootSVG.setAttribute("viewBox", `0 0 ${entityShape.preferredWidth} ${entityShape.preferredHeight}`);
    console.log("BBox: ", this.systemRootSVG.getBBox());

    this.showPropertiesView(true);
    this.showMetricsView(true);

    this.simulationTimer = new Timer(1, (ts) => {
      const count = this.exercise.simulator.step(-1, 5000);
      // const timetaken = performance.now() - timestamp;
      // console.log("Processed: ", count, timetaken, "ms");
    });
    this.metricsListTimer = new Timer(500, (ts) => {
      this.metricsListView.updateAll();
      /*
    if (this.diagnostics != null) {
      const timetaken = performance.now() - timestamp;
      this.diagnostics.notifyTimeTaken(timetaken, "Total Metrics Update", null);
    }
   */
    });
  }

  actorClicked(event: Event, actor: Nullable<Actor> = null): void {
    if (actor != null) {
      console.log("Clicked On: ", event.target);
      console.log("Actor: ", actor);
    }
  }

  showPropertiesView(show = true): void {
    if (show) {
      this.propertiesDiv.style.display = "table-cell";
    } else {
      this.propertiesDiv.style.display = "none";
    }
  }

  showMetricsView(show = true): void {
    if (show) {
      this.metricsListDiv.style.display = "table-cell";
    } else {
      this.metricsListDiv.style.display = "none";
    }
  }

  showActorProperties(actor: Nullable<Actor>): void {
    if (actor == null || actor.parent == null) {
      this.propertiesDiv.style.display = "none";
    } else {
      this.propertiesDiv.style.display = "table-cell";
      // TODO: Create PropertyGroup from actor
      // this.propertiesView.entity = actor;
    }
  }

  simulationRunning = false;
  startOrStopSimulation(): void {
    this.simulationRunning = false;
    if (this.startStopButton.innerHTML == "Start") {
      this.exercise.reset();
      // this.metricsListView.entity = this.exercise.allMetrics;
      this.showPropertiesView(true);
      this.showMetricsView(true);
      this.startStopButton.innerHTML = "Stop";
      // this.contPauseButton.disabled = false;
      // this.stepButton.disabled = false;
      // this.stepDurationSelect.disabled = false;
      this.exercise.startClients();
      this.metricsListTimer.start();
      this.simulationTimer.start();
    } else {
      this.startStopButton.innerHTML = "Start";
      // this.contPauseButton.disabled = true;
      // this.stepButton.disabled = true;
      // this.stepDurationSelect.disabled = true;
      this.simulationTimer.stop();
      this.metricsListTimer.stop();
    }
  }

  /**
   * Called to start the simulation.
   */
  continueOrPauseSimulation(): void {
    /*
    if (this.contPauseButton.innerHTML == "Continue") {
      this.contPauseButton.innerHTML = "Pause";
      this.simulationRunning = true;
      // this.stepButton.disabled = true;
      // this.stepDurationSelect.disabled = true;
    } else {
      this.contPauseButton.innerHTML = "Continue";
      this.simulationRunning = false;
      // this.stepButton.disabled = false;
      // this.stepDurationSelect.disabled = false;
    }
    */
  }
}
