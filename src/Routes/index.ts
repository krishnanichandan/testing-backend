import { Router } from 'express';

import playerRoute from './playerRoutes'



const router = Router();

router.use('/player', playerRoute);




export default router;