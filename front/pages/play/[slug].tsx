// pages/[slug].tsx
import { useEffect, useRef, useState } from 'react'
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next'
import { Game } from '@/game/game'
import GameHud from '@/components/GameHud'
import LoadingScreen from '@/components/LoadingScreen'
import { ChatListComponent } from '@shared/component/ChatComponent'
import { NextSeo } from 'next-seo'
import { Joystick } from 'react-joystick-component'
import gameData from '../../public/gameData.json'

export interface GameInfo {
  title: string
  slug: string
  imageUrl: string
  websocketPort: number
  images?: { url: string; width: number; height: number; alt: string; type: string }[]
  metaDescription: string
}

interface GamePageProps {
  gameInfo: GameInfo
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = gameData.map((game) => ({
    params: { slug: game.slug },
  }))

  return {
    paths,
    fallback: false, // can be 'blocking' or 'true' if you want fallback behavior
  }
}

export const getStaticProps: GetStaticProps<GamePageProps> = async (context) => {
  const { slug } = context.params!
  const game = gameData.find((game) => game.slug === slug)

  return {
    props: {
      gameInfo: game!,
    },
    // Re-generate the page every 5 minutes
    revalidate: 5 * 60,
  }
}

export default function GamePage({ gameInfo }: InferGetStaticPropsType<typeof getStaticProps>) {
  const [isLoading, setIsLoading] = useState(true)
  const [chat, updateChat] = useState<ChatListComponent>()
  const [gameInstance, setGameInstance] = useState<Game>()
  const refContainer = useRef(null)

  useEffect(() => {
    async function initializeGame() {
      const game = Game.getInstance(gameInfo.websocketPort, refContainer)
      game.hud.passChatState(updateChat)
      setGameInstance(game)
      try {
        await game.start() // Wait for WebSocket connection
        setIsLoading(false) // Update state to stop showing "connecting" message
      } catch (error) {
        console.error('Error connecting to WebSocket:', error)
      }
    }

    initializeGame()
  }, [gameInfo.websocketPort])

  return (
    <>
      <NextSeo
        title={`Play ${gameInfo.title} - NotBlox`}
        description={gameInfo.metaDescription}
        canonical={`https://www.notblox.online/${gameInfo.slug}`}
        openGraph={{
          title: `Play ${gameInfo.title} - NotBlox`,
          description: gameInfo.metaDescription,
          images: gameInfo.images ?? [],
          siteName: 'NotBlox Online',
        }}
        twitter={{
          handle: '@iercan_',
          site: '@iercan_',
          cardType: 'summary_large_image',
        }}
      />
      {isLoading && <LoadingScreen />}
      <div ref={refContainer}>
        <div style={{ position: 'absolute', bottom: '100px', left: '100px' }}>
          <Joystick
            size={100}
            baseColor="gray"
            stickColor="black"
            move={(props) => gameInstance?.inputManager.handleJoystickMove(props)}
            stop={(props) => gameInstance?.inputManager.handleJoystickStop(props)}
          />
        </div>{' '}
        <GameHud chatList={chat} sendMessage={gameInstance?.hud.sendMessageToServer!} />
      </div>
    </>
  )
}
