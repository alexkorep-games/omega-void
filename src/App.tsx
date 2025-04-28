import React from 'react';
import { Stage, Container, Sprite, Text, Graphics, TilingSprite, TextStyle, Rectangle } from 'pixi.js'; // Import necessary classes from pixi.js
import { Application, extend, useTick } from '@pixi/react'; // Import extend and Application from @pixi/react
import * as C from './config';
import { useGameLogic } from './hooks/useGameLogic';

// Import your drawing components
import { PlayerGraphics } from './components/drawing/PlayerGraphics';
import { EnemyGraphics } from './components/drawing/EnemyGraphics';
import { ProjectileGraphics } from './components/drawing/ProjectileGraphics';
import { StarGraphics } from './components/drawing/StarGraphics';
import { StationGraphics } from './components/drawing/StationGraphics';
import { HUDGraphics } from './components/drawing/HUDGraphics';
import { TouchControlsGraphics } from './components/drawing/TouchControlsGraphics';

// Extend @pixi/react with the PixiJS components you want to use as JSX tags
// This should be done once, typically near the root of your Pixi app.
extend({ Graphics, Text, Container, Sprite, Stage, TilingSprite }); // Add any other components you might need

const GameView: React.FC = () => {
    const {
        gameState,
        updateGame,
        handlePointerDown,
        handlePointerMove,
        handlePointerUpOrLeave,
    } = useGameLogic();

    // Register the update function with the Pixi ticker
    useTick(updateGame);

    // Calculate viewport offset based on camera
    const viewportX = -gameState.camera.x;
    const viewportY = -gameState.camera.y;

    return (
        <>
            {/* Game World Container - applies camera offset */}
            <pixiContainer x={viewportX} y={viewportY}>
                {/* Background Objects */}
                {gameState.visibleBackgroundObjects.map((obj) => {
                    if (obj.type === 'star') {
                        return <StarGraphics key={obj.id} star={obj} />;
                    } else if (obj.type === 'station') {
                        return <StationGraphics key={obj.id} station={obj} />;
                    }
                    return null;
                })}

                {/* Projectiles */}
                {gameState.projectiles.map((proj) => (
                    <ProjectileGraphics key={proj.id} projectile={proj} />
                ))}

                {/* Enemies */}
                {gameState.enemies.map((enemy) => (
                    <EnemyGraphics key={enemy.id} enemy={enemy} />
                ))}

                {/* Player */}
                <PlayerGraphics player={gameState.player} />

            </pixiContainer> {/* End Game World Container */}


            {/* HUD Layer - fixed position */}
            <HUDGraphics gameState={gameState} />

            {/* Touch Controls Layer - fixed position */}
            <TouchControlsGraphics touchState={gameState.touchState} />

            {/* Coordinates Display (Example using PixiText) */}
             <pixiText
                 text={`X: ${Math.floor(gameState.player.x)}, Y: ${Math.floor(gameState.player.y)}`}
                 x={5}
                 y={5}
                 style={new TextStyle({
                     fontFamily: 'monospace',
                     fontSize: 12,
                     fill: C.HUD_COLOR,
                     align: 'left',
                 })}
             />
        </>
    );
};


const App: React.FC = () => {
    return (
        <Application
            width={C.GAME_WIDTH}
            height={C.GAME_HEIGHT}
            backgroundColor={C.BACKGROUND_COLOR}
            antialias={false} // Use false for pixelated look
            resolution={window.devicePixelRatio || 1}
            autoDensity={true}
        >
            {/* Interaction Layer - covers the whole stage for input */}
             <pixiContainer
                 interactive={true} // Enable interaction for the stage
                 hitArea={new PIXI.Rectangle(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT)} // Ensure it covers the whole area
                 pointerdown={handlePointerDown}
                 pointermove={handlePointerMove}
                 pointerup={handlePointerUpOrLeave}
                 pointerupoutside={handlePointerUpOrLeave} // Handle pointer leaving the area
                 pointercancel={handlePointerUpOrLeave} // Handle touch cancel
             >
                <GameView />
             </pixiContainer>
        </Application>
    );
};

export default App;
