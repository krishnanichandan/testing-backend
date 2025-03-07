import * as schedule from 'node-schedule';

import { continueBetPhase, continueGameSession } from './GameSessionHelper';

import { leavePlayer } from '../game/leaveHelper';
import { matchMaker } from 'colyseus';
import { updateTableSettingsInDb } from '../../db/Queries';

type ScheduleJob = schedule.Job;

const INACTIVE_PLAYER_TIME = 5 * 60;//10;//seconds
const REMOVE_PLAYER_SESSION_EXCEEDED = 15;


export class SchedulerHelper {
    private static _instance: SchedulerHelper;

    private removeInactivePlayerJobs: Record<string, ScheduleJob>;
    private playerPlaySessionJobs: Record<string, ScheduleJob>;
    private removePlayer: Record<string, ScheduleJob>;
    private removePlayerBetNotResponded: Record<string, ScheduleJob>

    constructor() {
        this.removeInactivePlayerJobs = {};
        this.playerPlaySessionJobs = {};
        this.removePlayer = {};
        this.removePlayerBetNotResponded = {};
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }




    removeInactivePlayer(tableId: string, playerId: string) {
        if (!!this.removeInactivePlayerJobs[tableId + "/" + playerId]) {
            console.log("already added");
            return
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (INACTIVE_PLAYER_TIME * 1000));
        const job = schedule.scheduleJob(scheduleTime, async () => {
            let room = matchMaker.getRoomById(tableId);
            let leavePayload = {
                playerId: playerId,
                tableId: tableId,
                isStandUp: false,
                isRequested: false,
                room: room
            }
            let res = await leavePlayer(leavePayload);
        });
        this.removeInactivePlayerJobs[tableId + "/" + playerId] = job;
    }

    clearInactivePlayerJob(tableId: string, playerId: string): void {
        const job = this.removeInactivePlayerJobs[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Inactive Player Job cleared")
            delete this.removeInactivePlayerJobs[tableId + "/" + playerId];
        }
    }

    startPlayerPlaySession(tableId: string, playerId: string, PLAYER_PLAY_SESSION: number) {
        console.log("start Player Play Session Called")
        if (!!this.playerPlaySessionJobs[tableId + "/" + playerId]) {
            console.log("already added");
            return
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (PLAYER_PLAY_SESSION * 60 * 1000));
        const job = schedule.scheduleJob(scheduleTime, async () => {
            console.log("start Player Play Session Started->")
            let room = matchMaker.getRoomById(tableId);

            let query = {
                id: tableId,
                'currentInfo.players': {
                    $elemMatch: {
                        playerId: playerId
                    }
                }
            }
            let updateField = {
                $set: {
                    "currentInfo.players.$.playerPlaySessionExceeded": true
                }
            }

            await updateTableSettingsInDb({ filter: query, updateObj: updateField });
        });
        this.playerPlaySessionJobs[tableId + "/" + playerId] = job;
    }

    clearPlayerPlaySession(tableId: string, playerId: string): void {
        const job = this.playerPlaySessionJobs[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Player session Job cleared")
            delete this.playerPlaySessionJobs[tableId + "/" + playerId];
        }
    }

    removePlayerIfSessionExceed(tableId: string, playerId: string) {
        console.log("Remove Player Called")
        if (!!this.removePlayer[tableId + "/" + playerId]) {
            console.log("already added");
            return
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (REMOVE_PLAYER_SESSION_EXCEEDED * 1000));
        const job = schedule.scheduleJob(scheduleTime, async () => {
            console.log("Remove Player Started->")
            let room = matchMaker.getRoomById(tableId);
            let payload = {
                playerId: playerId,
                tableId: tableId,
                room: room,
                isPlayerWantsToContinueGameSession: false
            }
            let res = await continueGameSession(payload);
        });
        this.removePlayer[tableId + "/" + playerId] = job;
    }

    clearRemovePlayerJob(tableId: string, playerId: string): void {
        const job = this.removePlayer[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Remove Player Job cleared")
            delete this.removePlayer[tableId + "/" + playerId];
        }
    }
    isJobScheduledForRemovePlayerSessionPopUp(tableId: string, playerId: string) {
        const job = this.removePlayer[tableId + "/" + playerId];
        if (job) return true;
        else return false;
    }

    removePlayerIfBetPhasePopNotResponsd(tableId: string, playerId: string) {
        console.log("Remove Player bet phase Called")
        if (!!this.removePlayerBetNotResponded[tableId + "/" + playerId]) {
            console.log("already added");
            return
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (REMOVE_PLAYER_SESSION_EXCEEDED * 1000));
        const job = schedule.scheduleJob(scheduleTime, async () => {
            console.log("Remove Player bet phase started")
            let room = matchMaker.getRoomById(tableId);
            let payload = {
                room: room,
                playerId: playerId,
                tableId: tableId,
                isPlayerWantsToContinueBetPhase: false
            }
            let res = await continueBetPhase(payload);
        });
        this.removePlayerBetNotResponded[tableId + "/" + playerId] = job;
    }

    isJobScheduledForBetPhase(tableId: string, playerId: string) {
        const job = this.removePlayerBetNotResponded[tableId + "/" + playerId];
        if (job) return true;
        else return false;
    }

    clearRemovePlayerBetPhasePopUpJob(tableId: string, playerId: string): void {
        const job = this.removePlayerBetNotResponded[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Remove Player bet Pop Up cleared")
            delete this.removePlayerBetNotResponded[tableId + "/" + playerId];
        }
    }
}

