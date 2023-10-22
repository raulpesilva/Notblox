import { PhysicsBodyComponent } from "../../component/PhysicsBodyComponent.js";
import { PositionComponent } from "../../../../../shared/component/PositionComponent.js";
import { Entity } from "../../../../../shared/entity/Entity.js";
import Rapier from "../../../physics/rapier.js";

export class SyncPositionSystem {
  update(entities: Entity[]) {
    entities.forEach((entity) => {
      const bodyComponent = entity.getComponent(PhysicsBodyComponent);
      const positionComponent = entity.getComponent(PositionComponent);

      if (bodyComponent && positionComponent) {
        const position = bodyComponent.body.translation();
        positionComponent.x = position.x;
        positionComponent.y = position.y;
        positionComponent.z = position.z;
      }
    });
  }
}
