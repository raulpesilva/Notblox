// Initialize world and ball
new MapWorld(
  'https://rawcdn.githack.com/iErcann/Notblox-Assets/50f73702842fc334177d7ed3e2a2b63816c503e2/Stadium.glb'
)

const ballSpawnPosition = { x: 0, y: -20, z: -350 }
const sphereParams = {
  radius: 1.4,
  position: {
    x: ballSpawnPosition.x,
    y: ballSpawnPosition.y,
    z: ballSpawnPosition.z,
  },
  meshUrl:
    'https://rawcdn.githack.com/iErcann/Notblox-Assets/f8b474a703930afb1caa82fd2bda4ca336a00a29/Ball.glb',
  physicsProperties: {
    mass: 1,
    // Enable continuous collision detection to prevent the ball from going through the walls
    enableCcd: true,
    angularDamping: 0.5,
  },
}

let ball
// Initialize the ball using SphereParams
ball = new Sphere(sphereParams)
ball.entity.addComponent(
  new SpawnPositionComponent(
    ball.entity.id,
    ballSpawnPosition.x,
    ballSpawnPosition.y,
    ballSpawnPosition.z
  )
)

// Score display and management
const scoreText = new FloatingText('🔴 0 - 0 🔵', 0, 0, -450, 200)
let redScore = 0,
  blueScore = 0

// Chat functionality
const chatEntity = EntityManager.getFirstEntityWithComponent(
  EntityManager.getInstance().getAllEntities(),
  ChatComponent
)

const sendChatMessage = (author, message) => {
  EventSystem.addEvent(new ChatMessageEvent(chatEntity.id, author, message))
}

const updateScore = () => {
  sendChatMessage('⚽', `Score: 🔴 Red ${redScore} - ${blueScore} Blue 🔵`)
  scoreText.updateText(`🔴 ${redScore} - ${blueScore} 🔵`)
}

// Initialize chat and score
sendChatMessage('⚽', 'Football NotBlox.Online')
updateScore()

// Team spawn teleporters and coloring
function createTeamTrigger(x, y, z, color, spawnX) {
  return new TriggerCube(
    x,
    y,
    z,
    12,
    2,
    12,
    (collidedWithEntity) => {
      // If the player collides with the trigger, we change his color and teleport him to the stadium
      if (collidedWithEntity.getComponent(PlayerComponent)) {
        // Change the player color
        EventSystem.addEvent(new ColorEvent(collidedWithEntity.id, color))
        // Teleport the player to the spawn point
        collidedWithEntity
          .getComponent(DynamicRigidBodyComponent)
          .body.setTranslation(new Rapier.Vector3(spawnX, 5, -350), true)
      }
    },
    () => {},
    false // We don't want the trigger to be visible, put it to true if you want to debug its position
  )
}
// Create team triggers
createTeamTrigger(-24, -4, -29, '#f0513c', -80) // Red team
createTeamTrigger(24, -4, -29, '#3c9cf0', 80) // Blue team

// Goal handling
function handleGoal(scoringTeam) {
  if (scoringTeam === 'blue') blueScore++
  else redScore++

  sendChatMessage('⚽', `${scoringTeam === 'blue' ? '🔵 Blue' : '🔴 Red'} team scores! 🎉`)
  updateScore()

  const body = ball.entity.getComponent(DynamicRigidBodyComponent).body
  body.setTranslation(
    new Rapier.Vector3(ballSpawnPosition.x, ballSpawnPosition.y, ballSpawnPosition.z),
    new Rapier.Quaternion(0, 0, 0, 1)
  )
  body.setLinvel(new Rapier.Vector3(0, 0, 0), true)
}

// Create goal triggers
new TriggerCube(
  -120,
  -40,
  -350,
  5,
  10,
  13,
  (collidedWithEntity) => collidedWithEntity.id === ball.entity.id && handleGoal('blue'),
  () => {},
  false
)

new TriggerCube(
  120,
  -40,
  -350,
  5,
  10,
  13,
  (collidedWithEntity) => collidedWithEntity.id === ball.entity.id && handleGoal('red'),
  () => {},
  false
)

ScriptableSystem.update = (dt, entities) => {
  // Check if there are any players
  const hasPlayers = entities.some((entity) => entity.getComponent(PlayerComponent))

  if (!hasPlayers) {
    // No players are present. Reset the game
    sendChatMessage('⚽', 'No players, resetting game...')

    const ballBody = ball.entity.getComponent(DynamicRigidBodyComponent).body
    ballBody.setTranslation(
      new Rapier.Vector3(ballSpawnPosition.x, ballSpawnPosition.y, ballSpawnPosition.z),
      new Rapier.Quaternion(0, 0, 0, 1)
    )
    ballBody.setLinvel(new Rapier.Vector3(0, 0, 0), true)

    redScore = 0
    blueScore = 0
    updateScore()
  }
}

// When the player is near the ball, he can shoot it
// For that, we need to add a proximity prompt component to the ball
// The front also needs to render a proximity prompt above the ball

// That's why the proximity prompt component is added to the network data component to be synced with the front
const proximityPromptComponent = new ProximityPromptComponent(ball.entity.id, {
  text: 'Kick',
  onInteract: (playerEntity) => {
    const ballRigidbody = ball.entity.getComponent(DynamicRigidBodyComponent)
    const playerRotationComponent = playerEntity.getComponent(RotationComponent)

    if (ballRigidbody && playerRotationComponent && playerEntity.getComponent(InputComponent)) {
      // Convert rotation to direction vector
      const direction = playerRotationComponent.getForwardDirection()
      // Calculate player looking direction
      // sendChatMessage('⚽', `Player shot the ball !`)
      const playerLookingDirectionVector = new Rapier.Vector3(
        direction.x * 500,
        0,
        direction.z * 500
      )

      ballRigidbody.body.applyImpulse(playerLookingDirectionVector, true)
    }
  },
  maxInteractDistance: 5,
  interactionCooldown: 2000,
  holdDuration: 0,
})
const networkDataComponent = ball.entity.getComponent(NetworkDataComponent)
networkDataComponent.addComponent(proximityPromptComponent)
ball.entity.addComponent(proximityPromptComponent)
