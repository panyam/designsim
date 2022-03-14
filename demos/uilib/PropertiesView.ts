import "./styles/PropertiesView";
import { Nullable } from "../../src/types";
import { propertyByPath, pathUntil } from "../../src/actors/utils";
import { removeNode, insertAfter, ensureAttr, setAttr, getAttr, createNode } from "../../src/utils/dom";
import { assert } from "../../src/utils/misc";
import { StrToDuration } from "../../src/utils/timeutils";
import { View } from "./Views";
import { Exercise } from "./Exercise";

export class PropertiesView extends View<any> {
  propertiesBody: HTMLDivElement;
  propertiesHeader: HTMLDivElement;
  propertiesFooter: HTMLDivElement;
  propertiesTable: HTMLDivElement;
  updateButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  exercise: Exercise;

  constructor(elem: Element, exercise: Exercise) {
    super(elem, "propertyGroups", null);
    this.exercise = exercise;
  }

  template(): string {
    return `
      <div class = "propertiesHeader"> {{ actor.name }} </div>
      <div class = "propertiesBody">
        <div class = "propertiesTable">
        </div>
      </div>
      <div class = "propertiesFooter">
        <button class = "updateButton">Update</button> |
        <button class = "resetButton">Reset</button>
      </div>
    `;
  }

  setupViews(): void {
    super.setupViews();

    this.propertiesBody = this.find(".propertiesBody") as HTMLDivElement;
    this.propertiesHeader = this.find(".propertiesHeader") as HTMLDivElement;
    this.propertiesFooter = this.find(".propertiesFooter") as HTMLDivElement;
    this.propertiesTable = this.find(".propertiesTable") as HTMLDivElement;
    this.updateButton = this.find(".updateButton") as HTMLButtonElement;
    this.resetButton = this.find(".resetButton") as HTMLButtonElement;
    this.propertiesTable.innerHTML = this.rootElementHTML;

    this.processPropertyFields();

    this.updateButton.addEventListener("click", () => {
      this.updateEntityFromViews();
    });
    this.resetButton.addEventListener("click", () => {
      if (this.entity != null) {
        this.updateViewsFromEntity(this.entity);
      }
    });

    // now listen to changes to property inputs
    const propInputs = this.findAll(".propertyValueInput");
    propInputs.forEach((input) => {
      const propPath = input.getAttribute("propertyPath");
      if (propPath != null) {
        input.addEventListener("change", (evt: Event) => {
          if (evt.target != null && evt.target instanceof HTMLInputElement) {
            this.processPropertyChanged(evt.target);
          }
        });
      }
    });

    const customPropInputs = this.findAll(".customPropertyValueInput");
    customPropInputs.forEach((input) => {
      input.addEventListener("change", (evt: Event) => {
        if (evt.target != null && evt.target instanceof HTMLInputElement) {
          this.processCustomPropertyChanged(evt.target);
        }
      });
    });
    setTimeout(() => {
      customPropInputs.forEach((input) => {
        this.processCustomPropertyChanged(input as HTMLInputElement);
      });
    }, 0);
  }

  /**
   * Go through all Property tags and expand them into
   * appropriate inputs.
   * Then do a second pass and extract all actor property inputs
   * and add change handling into them.
   */
  processPropertyFields(): void {
    const propertyNodes = this.propertiesTable.querySelectorAll("Property");
    const system = this.exercise.system!;
    propertyNodes.forEach((pnode) => {
      //
      console.log("Here");
      const d1 = createNode(this.document, "div", undefined, { class: "propertyRow" });
      const d2 = createNode(this.document, "div", undefined, { class: "propertyRow" });
      insertAfter(pnode, d1, d2);
      removeNode(pnode);

      const label = getAttr(pnode, "label") || null;
      const disabled = getAttr(pnode, "disabled") || null;
      const minValue = getAttr(pnode, "min") || null;
      const maxValue = getAttr(pnode, "max") || null;
      const currValue = getAttr(pnode, "value") || null;
      let valuesString = "";
      if (disabled != null) {
        valuesString += ` disabled = "true"`;
      }
      if (minValue != null) {
        valuesString += ` min = "${StrToDuration(minValue)}"`;
      }
      if (maxValue != null) {
        valuesString += ` max = "${StrToDuration(maxValue)}"`;
      }
      if (currValue != null) {
        valuesString += ` value = "${StrToDuration(currValue)}"`;
      }
      const propertyPath = getAttr(pnode, "path") || null;
      if (propertyPath != null) {
        const [actor, property] = propertyByPath(system, propertyPath);
        assert(property != null && actor != null, "Invalid path: " + propertyPath);
        const schema = property.schema;
        const propertyLabel = label == null ? `${schema.name} (${schema.units})` : label;

        // Add a label row
        d1.innerHTML = `
          <div class = "propertyNameCell">${propertyLabel}</div>
          `;
        // Add the value row
        d2.innerHTML = `
          <div class = "propertyValueCell">
            <input type = "number"
                   class = "propertyValueInput"
                   ${valuesString}
                   propertyPath = "${pathUntil(actor, this.exercise.system)}.${schema.name}" />
          </div>`;
      } else {
        // we *must* have a custom handler
        assert(label != null, "Label MUST exist for custom fields");
        const handler = ensureAttr(pnode, "handler");
        // Add a label row
        d1.innerHTML = `<div class = "propertyNameCell">${label}</div>`;

        // Add the value row
        d2.innerHTML = `
          <div class = "propertyValueCell">
            <input type = "number"
                   handler = "${handler}"
                   ${valuesString}
                   class = "customPropertyValueInput"/>
          </div>`;
      }
    });

    const propertyInputNodes = this.propertiesTable.querySelectorAll(".propertyValueInput");
    propertyInputNodes.forEach((inNode) => {
      const propertyPath = ensureAttr(inNode, "propertyPath");
      const [actor, property] = propertyByPath(system, propertyPath);
      assert(actor != null, "Invalid actor id");
      assert(property != null, "Invalid propertyPath");
      const schema = property.schema;

      if (inNode.hasAttribute("value")) {
        property.setValue(actor, (inNode as HTMLInputElement).valueAsNumber);
      } else {
        (inNode as HTMLInputElement).value = property.value;
      }
      if (!inNode.hasAttribute("min") && schema.minValue != null) {
        setAttr(inNode, "min", schema.minValue);
      }
      if (!inNode.hasAttribute("max") && schema.maxValue != null) {
        setAttr(inNode, "max", schema.maxValue);
      }
      setAttr(inNode, "propertyName", schema.name);
    });
  }

  processCustomPropertyChanged(input: HTMLInputElement): void {
    const handler = ensureAttr(input, "handler");
    const newValue = input.valueAsNumber;
    if (!this.exercise.customPropertyChanged(handler, newValue)) {
      // Revert changes
    }
  }

  processPropertyChanged(input: HTMLInputElement): void {
    const propPath = ensureAttr(input, "propertyPath");
    const propName = ensureAttr(input, "propertyName");
    const system = this.exercise.system!;
    const [actor, property] = propertyByPath(system, propPath);
    assert(property != null && actor != null, "Invalid path: " + propPath);
    // const schema = property.schema;
    const newValue = input.valueAsNumber;
    (actor as any)[propName] = newValue;
    input.value = property.value;
  }
}
