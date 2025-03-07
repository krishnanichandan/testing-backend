
export type Card = {
    name: string,
    type: string,
    value: number,
    color?: string
}

export type HandValue = {
    hi: number,
    lo: number
}

export enum EndingType {
    GameComplete = "GameComplete",
    EverybodyPacked = "EverybodyPacked",
    OnlyOnePlayerLeft = "OnlyOnePlayerLeft",
}

export enum GameState {
    Idle = 'Idle',
    Starting = 'Starting',
    Waiting = 'Waiting',
    Betting = 'Betting',
    Running = 'Running',
    Over = 'Over'
}


export enum PlayerState {
    Waiting = 'Waiting',
    Starting = 'Starting',
    Betting = 'Betting',
    Playing = 'Playing',
    Ready = 'Ready',
    OutOfMoney = 'OutOfMoney',
    OnBreak = 'OnBreak',
    Disconnected = 'Disconnected',
    onLeave = 'onLeave',
    Reserved = 'Reserved'
}

