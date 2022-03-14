import "./styles/ListView";
import { createNode } from "../../src/utils/dom";
import { Nullable } from "../../src/types";
import { View } from "./Views";

export abstract class ListView<EntityType, EntityViewType extends View<EntityType>> extends View<EntityType[]> {
  listViewBodyDiv: HTMLDivElement;
  listViewHeaderDiv: HTMLDivElement;
  listViewFooterDiv: HTMLDivElement;
  listViewTableDiv: HTMLDivElement;
  entityViews: EntityViewType[] = [];

  get headerHeight(): string {
    return "0px";
  }
  get footerHeight(): string {
    return "0px";
  }

  template(): string {
    return `
      <div class = "listViewHeader" style = "height: ${this.headerHeight}"> </div>
      <div class = "listViewBody" style = "top: ${this.headerHeight}; bottom: ${this.footerHeight}">
        <div class = "listViewTable"> </div>
      </div>
      <div class = "listViewFooter" style = "height: ${this.footerHeight}"></div>
    `;
  }

  setupViews(): void {
    super.setupViews();
    this.listViewHeaderDiv = this.find(".listViewHeader") as HTMLDivElement;
    this.listViewBodyDiv = this.find(".listViewBody") as HTMLDivElement;
    this.listViewTableDiv = this.find(".listViewTable") as HTMLDivElement;
    this.listViewFooterDiv = this.find(".listViewFooter") as HTMLDivElement;
  }

  updateViewsFromEntity(entity: Nullable<EntityType[]>): void {
    super.updateViewsFromEntity(entity);
    this.listViewBodyDiv.innerHTML = "";
    entity = entity || [];
    this.entityViews = [];
    entity.forEach((entity) => {
      const newRow = createNode(this.document, "div");
      newRow.classList.add("listViewRow");
      this.listViewBodyDiv.append(newRow);
      const entityView = this.addViewForEntity(newRow);
      entityView.entity = entity;
      this.entityViews.push(entityView);
    });
  }

  abstract addViewForEntity(element: Element): EntityViewType;
}
