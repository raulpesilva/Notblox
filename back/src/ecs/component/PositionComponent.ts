import { Component } from "./component.js";

// Define a PositionComponent class
export class PositionComponent extends Component {
  constructor(
    entityId: number,
    public x: number,
    public y: number,
    public z: number
  ) {
    super(entityId); // Call the parent constructor with the entityId
  }
}
