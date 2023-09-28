import { Component } from "../component/component.js";

// Define an Entity class
export class Entity {
  private static nextId = 1;
  public id: number;
  public components: Component[] = [];

  constructor() {
    this.id = Entity.nextId++;
  }

  // Add a component to the entity
  addComponent(component: Component) {
    this.components.push(component);
  }

  // Remove a component from the entity
  removeComponent(componentType: typeof Component) {
    this.components = this.components.filter(
      (c) => !(c instanceof componentType)
    );
  }

  // Get a component from the entity
  getComponent<T extends Component>(
    componentType: new (entityId: number, ...args: any[]) => T
  ): T | undefined {
    return this.components.find((c) => c instanceof componentType) as
      | T
      | undefined;
  }
}
