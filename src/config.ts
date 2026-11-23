export const config = {
  simulation: {
    fixedTimeStep: 1 / 60,
  },
  maze: {
    columns: 15,
    rows: 9,
    cellSize: 96,
    wallThickness: 10,
    extraOpenings: 10,
  },
  tank: {
    moveSpeed: 180,
    turnSpeed: 2.8,
    radius: 22,
  },
  bullet: {
    speed: 500,
    lifetime: 8,
    maxPerTank: 5,
  },
  match: {
    scoreToWin: 5,
    roundOverDuration: 2.5,
  },
  input: {
    gamepadDeadZone: 0.18,
    keyboardDeadZone: 0.1,
  },
  presentation: {
    backgroundColor: 0x101820,
    wallColor: 0xe7edf2,
    floorColor: 0x182631,
    titleColor: "#f5f7fa",
    subtitleColor: "#a9bac7",
    fontFamily: "Arial, sans-serif",
    titleFontSize: 32,
    subtitleFontSize: 16,
    minimumCellSize: 1,
    boardPadding: 32,
    titleTopOffset: 24,
    titleHeight: 64,
  },
} as const;
