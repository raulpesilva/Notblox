import { pack, unpack } from "msgpackr";
import { App, DEDICATED_COMPRESSOR_3KB, SSLApp } from "uWebSockets.js";
import { EventDestroyedComponent } from "../../../../../shared/component/events/EventDestroyedComponent.js";
import {
  ClientMessage,
  ClientMessageType,
} from "../../../../../shared/network/client/base.js";
import { ChatMessage } from "../../../../../shared/network/client/chatMessage.js";
import { InputMessage } from "../../../../../shared/network/client/input.js";

import { EntityManager } from "../../../../../shared/entity/EntityManager.js";
import { ServerMessageType } from "../../../../../shared/network/server/base.js";
import { ConnectionMessage } from "../../../../../shared/network/server/connection.js";
import { SerializedEntityType } from "../../../../../shared/network/server/serialized.js";
import { NetworkDataComponent } from "../../component/NetworkDataComponent.js";
import { WebSocketComponent } from "../../component/WebsocketComponent.js";
import { EventChatMessage } from "../../component/events/EventChatMessage.js";
import { Player } from "../../entity/Player.js";
import { InputProcessingSystem } from "../InputProcessingSystem.js";

type MessageHandler = (ws: any, message: any) => void;

export class WebsocketSystem {
  private port = 8001;
  private players: Player[] = [];
  private messageHandlers: Map<ClientMessageType, MessageHandler> = new Map();
  private inputProcessingSystem: InputProcessingSystem;

  constructor() {
    const isProduction = process.env.NODE_ENV === "production";

    const app = isProduction
      ? SSLApp({
          /* SSL options */
          key_file_name: "/etc/letsencrypt/live/npm-1/privkey.pem",
          cert_file_name: "/etc/letsencrypt/live/npm-1/cert.pem",
        })
      : App();

    // Bind the methods to the current instance
    this.onMessage = this.onMessage.bind(this);
    this.onConnect = this.onConnect.bind(this);
    this.onClose = this.onClose.bind(this);

    app.ws("/*", {
      idleTimeout: 32,
      maxBackpressure: 1024,
      maxPayloadLength: 512,
      compression: DEDICATED_COMPRESSOR_3KB,
      message: this.onMessage, // Handle WebSocket messages
      open: this.onConnect,
      drain: (ws: any) => {
        console.log("WebSocket backpressure: " + ws.getBufferedAmount());
      },
      close: this.onClose,
    });

    app.listen(this.port, (listenSocket: any) => {
      if (listenSocket) {
        console.log(`WebSocket server listening on port ${this.port}`);
      } else {
        console.error(`Failed to listen on port ${this.port}`);
      }
    });

    this.inputProcessingSystem = new InputProcessingSystem();

    this.addMessageHandler(ClientMessageType.INPUT, async (ws, message) => {
      const inputMessage = message as InputMessage;

      const player = ws.player;

      if (!player) {
        console.error(`Player with WS ${ws} not found.`);
        return;
      }

      this.inputProcessingSystem.receiveInputPacket(
        player.getEntity(),
        inputMessage
      );
    });

    this.addMessageHandler(
      ClientMessageType.CHAT_MESSAGE,
      (ws, message: ChatMessage) => {
        // const chatEntity = EntityManager.getFirstEntityByType(
        //   EntityManager.getInstance().getAllEntities(),
        //   SerializedEntityType.CHAT
        // );
        // if (!chatEntity) {
        //   console.error("Chat entity not found");
        //   return;
        // }
        // const player = ws.player;
        // console.log(
        //   `Chat message from ${player.getEntity().id}: ${message.content}`
        // );
        // const eventChatMessage = new EventChatMessage(
        //   player.entity.id,
        //   player,
        //   message
        // );
        // chatEntity.addComponent(eventChatMessage);
      }
    );
  }

  public addMessageHandler(type: ClientMessageType, handler: MessageHandler) {
    this.messageHandlers.set(type, handler);
  }

  public removeMessageHandler(type: ClientMessageType) {
    this.messageHandlers.delete(type);
  }

  private onMessage(ws: any, message: any, isBinary: boolean) {
    const clientMessage: ClientMessage = unpack(message);

    const handler = this.messageHandlers.get(clientMessage.t);
    if (handler) {
      handler(ws, clientMessage);
    }
  }

  // Not used anymore since ws.player is set on first connection
  // Also could be rewritten with a hashmap for better performance
  private findPlayer(ws: any) {
    return (
      this.players.find((player) => {
        const websocketComponent = player
          .getEntity()
          .getComponent(WebSocketComponent);
        return websocketComponent && websocketComponent.ws === ws;
      }) || null
    );
  }

  // TODO: Create EventOnPlayerConnect and EventOnPlayerDisconnect to respects ECS
  // Might be useful to query the chat and send a message to all players when a player connects or disconnects
  // Also could append scriptable events to be triggered on connect/disconnect depending on the game
  private onConnect(ws: any) {
    const player = new Player(
      ws,
      10 + Math.random() * 3,
      10 + Math.random() * 7,
      20 + Math.random() * 3
    );
    const connectionMessage: ConnectionMessage = {
      t: ServerMessageType.FIRST_CONNECTION,
      id: player.entity.id,
    };
    ws.player = player;
    ws.send(pack(connectionMessage), true);
    this.players.push(player);
  }
  private onClose(ws: any, code: number, message: any) {
    const disconnectedPlayer = this.findPlayer(ws);

    if (!disconnectedPlayer) {
      console.error("Disconnect: Player not found?", ws);
      return;
    }

    const entity = disconnectedPlayer.getEntity();
    console.log("Disconnect: Player found!");

    const entityId = entity.id;

    // Removing WebSocketComponent to not retrigger a broadcast on this entity if its destroyed.
    // Otherwise it throws an error.
    entity.removeComponent(WebSocketComponent);

    // Create and add the EventDestroyedComponent
    const eventDestroyedComponent = new EventDestroyedComponent(entityId);
    entity.addComponent(eventDestroyedComponent);

    // Add the EventDestroyedComponent to the NetworkDataComponent if it exists
    const networkComponent = entity.getComponent(NetworkDataComponent);
    if (networkComponent) {
      networkComponent.addComponent(eventDestroyedComponent);
    }
  }
}
