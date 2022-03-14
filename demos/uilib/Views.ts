declare let Handlebars: any;
import { getCSS, setCSS, ensureElement } from "../../src/utils/dom";
// import { findElement } from "../ui/utils";
import { Nullable } from "../../src/types";

export class View<EntityType> {
  rootElement: HTMLElement;
  rootElementHTML: string;
  protected _template: any;
  readonly configs: any;
  readonly zIndex: number;
  protected _entity: Nullable<EntityType>;
  private viewsUpdated = true;
  private _viewsCreated = false;
  protected renderAsTemplate = true;
  entityName = "entity";

  constructor(
    elemOrId: Element | string,
    entityName: Nullable<string>,
    entity: Nullable<EntityType>,
    configs: any = null,
  ) {
    configs = configs || {};
    this._entity = entity;
    this.configs = configs;
    this.zIndex = configs.zIndex || 1000;
    this.renderAsTemplate = configs.renderAsTemplate || true;
    this.entityName = entityName || "entity";
    this.rootElement = ensureElement(elemOrId) as HTMLElement;
    this.rootElementHTML = this.rootElement.innerHTML;
    this._template = configs.template || "<div>Hello World</div>";
    setTimeout(() => this.setup(), 0);
  }

  find(target: string) {
    return this.rootElement.querySelector(target);
  }

  findAll(target: string) {
    return this.rootElement.querySelectorAll(target);
  }

  /**
   * This method is called to create the view hierarchy of this view.
   * When this method is called the binding to the model has not yet
   * happened and should not expect any presence of data/models
   * to populate the views with.
   */
  setup(): this {
    if (!this._viewsCreated) {
      this.willSetupViews();
      this.setupViews();
      this._viewsCreated = true;
      this.refreshViews();
    }
    return this;
  }

  refreshViews(): void {
    this.viewsUpdated = true;
    this.updateViewsFromEntity(this._entity);
  }

  /**
   * Called before views are setup.
   * Typically when views are setup the elements contents can be destroyed.
   * This hook provides the view to read any thing it needs from the view
   * before it is initialized.
   */
  protected willSetupViews() {
    // TB Implemented
  }

  /**
   * This method recreates the complete view heieararchy.
   */
  protected setupViews(): void {
    this.rootElement.innerHTML = this.html();
    setCSS(this.rootElement, "z-Index", this.zIndex);
  }

  /**
   * Called when the entity has been updated in order to update the views
   * and/or their contents.
   * In this method the underlying entity must *not* be changed.
   * By default does nothing.
   */
  protected updateViewsFromEntity(_entity: Nullable<EntityType>): void {
    // Do nothing - implement this
    this.setup();
  }

  /**
   * This method is called to update the entity based on what has
   * been input/entered into the views.  By default it does nothing.
   */
  protected updateEntityFromViews(): Nullable<EntityType> {
    return this._entity;
  }

  get viewsCreated(): boolean {
    return this._viewsCreated;
  }

  get entity(): Nullable<EntityType> {
    if (this.viewsUpdated && this._viewsCreated) {
      this._entity = this.updateEntityFromViews();
      this.viewsUpdated = false;
    }
    return this._entity;
  }

  set entity(entity: Nullable<EntityType>) {
    if (entity != this._entity && this.isEntityValid(entity)) {
      this._entity = entity;
      this.refreshViews();
    }
  }

  protected isEntityValid(_entity: Nullable<EntityType>) {
    return true;
  }

  html() {
    if (this.renderAsTemplate) {
      return this.renderedTemplate();
    } else {
      return this.template();
    }
  }

  template() {
    return this._template;
  }

  setTemplate(t: string) {
    this._template = t;
    return this;
  }

  enrichViewParams(viewParams: any): any {
    // viewParams["Defaults"] = BCDefaults;
    return viewParams;
  }

  renderedTemplate(viewParams: any = null) {
    viewParams = this.enrichViewParams(viewParams || {});
    if (!(this.entityName in viewParams)) viewParams[this.entityName] = this._entity;
    const template = Handlebars.compile(this.template());
    return template(viewParams);
  }

  show() {
    // TODO
  }

  hide() {
    // TODO
  }

  get document() {
    return this.rootElement.ownerDocument;
  }

  get height() {
    return $(this.rootElement).height();
  }

  set height(value: any) {
    setCSS(this.rootElement, "height", value);
  }

  get width() {
    return $(this.rootElement).width();
  }

  set width(value: any) {
    setCSS(this.rootElement, "width", value);
  }

  get top() {
    return getCSS(this.rootElement, "top");
  }

  set top(value: any) {
    setCSS(this.rootElement, "top", value);
  }

  get left() {
    return getCSS(this.rootElement, "left");
  }

  set left(value: any) {
    setCSS(this.rootElement, "left", value);
  }

  get bottom() {
    return getCSS(this.rootElement, "bottom");
  }

  set bottom(value: any) {
    setCSS(this.rootElement, "bottom", value);
  }

  get right() {
    return getCSS(this.rootElement, "right");
  }

  set right(value: any) {
    setCSS(this.rootElement, "right", value);
  }
}
