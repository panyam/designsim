import { Nullable } from "../../src/types";
import { World } from "../../src/actors/base";
import { setAttr, createNode } from "../../src/utils/dom";
import { Diagnostics } from "../../src/utils/timeutils";
import { Metric, Metrics } from "../../src/actors/collector";
import { View } from "./Views";
import { ListView } from "./ListView";
import * as d3 from "d3";
import "./styles/MetricsView";

export class MetricsView extends View<Metrics> {
  world: World;
  diagnostics: Nullable<Diagnostics>;
  metricsRootSVG: SVGSVGElement;
  titleText: any;
  d3Root: d3.Selection<SVGSVGElement, Metric[], null, undefined>;
  chartPath: d3.Selection<SVGPathElement, Metric[], null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  xAxis: d3.Axis<number | { valueOf(): number }>;
  yAxis: d3.Axis<number | { valueOf(): number }>;
  yScale: d3.ScaleLinear<number, number>;
  lineFunc: d3.Line<Metric>;

  constructor(world: World, elem: Element, diagnostics: Nullable<Diagnostics> = null) {
    super(elem, "processor", null);
    this.world = world;
    this.diagnostics = diagnostics || null;
  }

  updateViewsFromEntity(entity: Nullable<Metrics>): void {
    super.updateViewsFromEntity(entity);
    if (entity == null) {
      this.titleText.text("");
    } else {
      this.titleText.text(entity.label);
    }
  }

  setupViews(): void {
    super.setupViews();
    this.rootElement.innerHTML = "";
    const computedStyles = getComputedStyle(this.rootElement) as any;
    // make graph width/height be 100% of parent and everything gets
    // drawn/created inside this
    const graphHeight = this.height;
    const graphWidth = this.width;
    const graphMargins = {
      left: 80,
      top: 20,
      right: 30,
      bottom: 30,
    };
    const leftMargin = parseInt(computedStyles["margin-left"] || "0px");
    const rightMargin = parseInt(computedStyles["margin-right"] || "0px");
    // const topMargin = parseInt(computedStyles["margin-top"] || "0px");
    // const bottomMargin = parseInt(computedStyles["margin-bottom"] || "0px");
    this.metricsRootSVG = createNode(this.document, "svg", "http://www.w3.org/2000/svg", {
      class: "metricsRootSVG",
    });
    this.rootElement.appendChild(this.metricsRootSVG);

    const leftBorder = parseInt(computedStyles["border-left"] || "0px");
    const rightBorder = parseInt(computedStyles["border-right"] || "0px");
    const topBorder = parseInt(computedStyles["border-top"] || "0px");
    const bottomBorder = parseInt(computedStyles["border-bottom"] || "0px");
    setAttr(this.metricsRootSVG, "width", graphWidth - (leftMargin + rightMargin) - (leftBorder + rightBorder));
    setAttr(this.metricsRootSVG, "height", graphHeight - (topBorder + bottomBorder) - (topBorder + bottomBorder));

    const d3Root = (this.d3Root = d3.select(this.metricsRootSVG));

    const xScale = (this.xScale = d3.scaleLinear().range([graphMargins.left, graphWidth - graphMargins.right]));
    const xAxis = (this.xAxis = d3
      .axisBottom(xScale)
      // .tickSizeInner(-h + 40)
      // .tickSizeOuter(0)
      .tickPadding(10));

    const yScale = (this.yScale = d3.scaleLinear().range([graphHeight - graphMargins.bottom, graphMargins.top]));
    const yAxis = (this.yAxis = d3
      .axisLeft(yScale)
      // .tickSizeInner(-w + 40)
      // .tickSizeOuter(0)
      .tickPadding(10));

    const lineFunc = (this.lineFunc = d3
      .line<Metric>()
      .x((d: Metric) => xScale(d.time))
      .y((d: Metric) => yScale(d.value)));

    // Create X Axis
    d3Root
      .append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + (graphHeight - graphMargins.bottom) + ")")
      // .attr("transform", "translate(0," + (h - (topMargin + bottomMargin) - (topBorder + bottomBorder)) + ")")
      .call(xAxis);

    // Create Y Axis
    d3Root
      .append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + graphMargins.left + ", 0)")
      .call(yAxis);

    this.chartPath = d3Root.append("path").datum([]).attr("d", lineFunc).attr("class", "metricsLine line");

    // Chart title
    this.titleText = d3Root
      .append("text")
      .attr("x", graphWidth / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .text(this.entity?.label || "Metrics");
  }

  /**
   * Called to update the graph based on latest metrics.
   */
  updateGraph(): void {
    // set new domains
    const t1 = performance.now();
    let results: Metric[] = [];
    if (this.entity == null) {
      this.xScale.domain([0, 100]);
      this.yScale.domain([0, 10]);
    } else {
      this.entity.ensureTimeTill(this.world.currTime - 1);
      results = this.entity.metrics;
      this.xScale.domain([results[0].time || 0, this.entity.maxTime]);
      this.yScale.domain([this.entity.minValue, this.entity.maxValue + 1]);
    }
    this.d3Root.select(".x.axis").call(this.xAxis);
    this.d3Root.select(".y.axis").call(this.yAxis);
    this.chartPath.datum(results).attr("d", this.lineFunc);
    if (this.entity != null && this.diagnostics != null) {
      const t2 = performance.now() - t1;
      this.diagnostics.notifyTimeTaken(t2, this.entity.label, this);
    }
  }
}

export class MetricsListView extends ListView<Metrics, MetricsView> {
  world: World;
  diagnostics: Nullable<Diagnostics>;

  constructor(elem: Element, world: World, diagnostics: Nullable<Diagnostics> = null) {
    super(elem, "metrics", null);
    this.world = world;
    this.diagnostics = diagnostics;
  }

  updateAll(): void {
    this.entityViews.forEach((mv) => mv.updateGraph());
  }

  addViewForEntity(element: Element): MetricsView {
    return new MetricsView(this.world, element, this.diagnostics);
  }
}
