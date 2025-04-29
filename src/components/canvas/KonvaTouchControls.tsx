import React from "react";
import { Circle, Group } from "react-konva";
import { ITouchState } from "../../game/types";
import * as C from "../../game/config";

interface KonvaTouchControlsProps {
  touchState: ITouchState;
}

const KonvaTouchControls: React.FC<KonvaTouchControlsProps> = ({
  touchState,
}) => {
  return (
    <Group listening={false}>
      {/* Movement Joystick */}
      {touchState.move.active && (
        <>
          <Circle
            x={touchState.move.startX}
            y={touchState.move.startY}
            radius={C.TOUCH_JOYSTICK_OUTER_RADIUS}
            stroke={"rgba(255, 255, 255, 0.3)"}
            strokeWidth={2}
          />
          {(() => {
            const dx = touchState.move.currentX - touchState.move.startX;
            const dy = touchState.move.currentY - touchState.move.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
            const clampedDist = Math.min(dist, C.TOUCH_JOYSTICK_OUTER_RADIUS);
            const stickX =
              touchState.move.startX + Math.cos(angle) * clampedDist;
            const stickY =
              touchState.move.startY + Math.sin(angle) * clampedDist;
            return (
              <Circle
                x={stickX}
                y={stickY}
                radius={C.TOUCH_JOYSTICK_INNER_RADIUS}
                fill={"rgba(255, 255, 255, 0.4)"}
              />
            );
          })()}
        </>
      )}
      {/* Shooting Indicator */}
      {touchState.shoot.active && (
        <>
          <Circle
            x={touchState.shoot.x}
            y={touchState.shoot.y}
            radius={C.TOUCH_SHOOT_INDICATOR_RADIUS}
            fill={"rgba(255, 0, 255, 0.2)"}
          />
          <Circle
            x={touchState.shoot.x}
            y={touchState.shoot.y}
            radius={C.TOUCH_SHOOT_INDICATOR_INNER_RADIUS}
            fill={"rgba(255, 0, 255, 0.5)"}
          />
        </>
      )}
    </Group>
  );
};

export default KonvaTouchControls;
