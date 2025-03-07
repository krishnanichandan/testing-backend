import { Router } from 'express';
// import { auth } from '../middlewares/Authentication';
import * as playerController from '../Controller/playerController';

const router = Router();
router.get('/getTusks/:playerId', playerController.getPlayerTusks);


export default router;