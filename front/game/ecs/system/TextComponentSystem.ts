import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent'
import { ComponentRemovedEvent } from '@shared/component/events/ComponentRemovedEvent'
import { Entity } from '@shared/entity/Entity'
import { EntityManager } from '@shared/system/EntityManager'
import { EventSystem } from '@shared/system/EventSystem'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { TextComponent } from '@shared/component/TextComponent'
import { MeshComponent } from '../component/MeshComponent'
import { CurrentPlayerComponent } from '../component/CurrentPlayerComponent'
import { PositionComponent } from '@shared/component/PositionComponent'
import { Game } from '@/game/game'
import * as THREE from 'three'
import { ProximityPromptComponent } from '@shared/component/ProximityPromptComponent'

export class TextComponentSystem {
  private textObjects: WeakMap<TextComponent, CSS2DObject> = new WeakMap()

  update(entities: Entity[]) {
    const currentPlayerEntity = EntityManager.getFirstEntityWithComponent(
      entities,
      CurrentPlayerComponent
    )
    if (!currentPlayerEntity) return
    this.handleAddedComponents(entities)
    this.handleRemovedComponents()
    this.processEntities(entities, currentPlayerEntity)
  }

  private createTextObject(
    textComponent: TextComponent,
    isProximityPrompt: boolean = false
  ): CSS2DObject {
    const textElement = document.createElement('div')
    this.updateTextElement(textElement, textComponent, isProximityPrompt)
    const textObject = new CSS2DObject(textElement)
    this.updateTextObjectPosition(textObject, textComponent)
    return textObject
  }

  private updateTextElement(
    textElement: HTMLElement,
    textComponent: TextComponent,
    isProximityPrompt: boolean
  ) {
    if (isProximityPrompt) {
      textElement.innerHTML = `
        <div class="flex items-center justify-between bg-gray-950/30 text-white p-2 rounded-md shadow-lg w-30">
          <div class="flex items-center justify-center w-8 h-8 bg-gray-700/50 rounded-full">
            <span class="text-lg font-bold">E</span>
          </div>
          <div class="ml-2">
            <p class="text-sm font-medium leading-tight">${textComponent.text}</p>
            <p class="text-xs text-gray-300">Interact</p>
          </div>
        </div>`
    } else {
      textElement.innerHTML = `
        <div class="flex items-center justify-between bg-gray-950/20 text-white p-2 rounded-md shadow-lg w-30">
          <p class="text-sm font-medium leading-tight">${textComponent.text}</p>
        </div>`
    }
  }

  private updateTextObjectPosition(
    textObject: CSS2DObject,
    textComponent: TextComponent,
    positionComponent?: PositionComponent
  ): void {
    const x = (positionComponent?.x ?? 0) + textComponent.offsetX
    const y = (positionComponent?.y ?? 0) + textComponent.offsetY
    const z = (positionComponent?.z ?? 0) + textComponent.offsetZ
    textObject.position.set(x, y, z)
  }

  private handleAddedComponents(entities: Entity[]): void {
    const createdEvents: ComponentAddedEvent<TextComponent>[] = EventSystem.getEventsWrapped(
      ComponentAddedEvent,
      TextComponent
    )

    for (const event of createdEvents) {
      const entity = EntityManager.getEntityById(entities, event.entityId)
      if (!entity) {
        console.error('TextComponentSystem: Entity not found', event.entityId)
        continue
      }

      // If the entity is the current player, we don't want to show the text
      const currentPlayerComponent = entity.getComponent(CurrentPlayerComponent)
      if (currentPlayerComponent) {
        // Ignore the current player text
        continue
      }

      const textObject = this.createTextObject(event.component)
      this.textObjects.set(event.component, textObject)

      // Attach to mesh if available and not the current player
      const meshComponent = entity.getComponent(MeshComponent)

      // Since some entities will not have a mesh, we will follow their position component in the update loop
      const parent = meshComponent?.mesh ?? Game.getInstance().renderer.scene
      parent.add(textObject)
    }

    const createdProximityPromptEvents: ComponentAddedEvent<ProximityPromptComponent>[] =
      EventSystem.getEventsWrapped(ComponentAddedEvent, ProximityPromptComponent)
    for (const event of createdProximityPromptEvents) {
      const entity = EntityManager.getEntityById(entities, event.entityId)
      if (!entity) {
        console.error('TextComponentSystem: Entity not found', event.entityId)
        continue
      }

      const proximityPromptComponent = event.component
      const textComponent = proximityPromptComponent.textComponent

      const textObject = this.createTextObject(textComponent, true)
      this.textObjects.set(textComponent, textObject)

      // Attach to mesh if available
      const meshComponent = entity.getComponent(MeshComponent)
      const parent = meshComponent?.mesh ?? Game.getInstance().renderer.scene
      parent.add(textObject)
    }
  }

  private handleRemovedComponents() {
    const removedEvents: ComponentRemovedEvent<TextComponent>[] = EventSystem.getEventsWrapped(
      ComponentRemovedEvent,
      TextComponent
    )

    for (const event of removedEvents) {
      const textObject = this.textObjects.get(event.component)
      if (textObject) {
        textObject.element.remove()
        textObject.removeFromParent() // Remove from mesh if attached
        this.textObjects.delete(event.component)
      }
    }

    const removedProximityPromptEvents: ComponentRemovedEvent<ProximityPromptComponent>[] =
      EventSystem.getEventsWrapped(ComponentRemovedEvent, ProximityPromptComponent)
    for (const event of removedProximityPromptEvents) {
      const textObject = this.textObjects.get(event.component.textComponent)
      if (textObject) {
        textObject.element.remove()
        textObject.removeFromParent() // Remove from mesh if attached
        this.textObjects.delete(event.component.textComponent)
      }
    }
  }

  private processEntities(entities: Entity[], currentPlayerEntity: Entity): void {
    for (const entity of entities) {
      const textComponent = entity.getComponent(TextComponent)
      if (textComponent) {
        this.processTextComponent(entity, textComponent, currentPlayerEntity)
      }
      const proximityPromptComponent = entity.getComponent(ProximityPromptComponent)
      if (proximityPromptComponent) {
        this.processTextComponent(
          entity,
          proximityPromptComponent.textComponent,
          currentPlayerEntity,
          true
        )
      }
    }
  }

  private processTextComponent(
    entity: Entity,
    textComponent: TextComponent,
    currentPlayerEntity: Entity,
    isProximityPrompt: boolean = false
  ): void {
    if (!textComponent) return

    const textObject = this.textObjects.get(textComponent)
    if (!textObject) return

    if (textComponent.updated) {
      this.updateTextElement(textObject.element, textComponent, isProximityPrompt)
      this.updateTextObjectPosition(textObject, textComponent)
    }

    if (!entity.getComponent(MeshComponent)) {
      const positionComponent = entity.getComponent(PositionComponent)
      if (positionComponent) {
        this.updateTextObjectPosition(textObject, textComponent, positionComponent)
      }
    }

    if (currentPlayerEntity) {
      this.updateVisibility(entity, currentPlayerEntity, textComponent)
    }
  }

  private updateVisibility(
    entityWithText: Entity,
    currentPlayerEntity: Entity,
    textComponent: TextComponent
  ): void {
    const textObject = this.textObjects.get(textComponent)

    if (!textObject) return

    const position = entityWithText.getComponent(PositionComponent)
    const playerPosition = currentPlayerEntity.getComponent(PositionComponent)

    if (!textObject || !position || !playerPosition) return

    const distance = this.calculateDistance(position, playerPosition)

    textObject.visible = distance <= textComponent.displayDistance
  }

  private calculateDistance(pos1: PositionComponent, pos2: PositionComponent): number {
    return new THREE.Vector3(pos1.x, pos1.y, pos1.z).distanceTo(
      new THREE.Vector3(pos2.x, pos2.y, pos2.z)
    )
  }
}
