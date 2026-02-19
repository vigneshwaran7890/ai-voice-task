// routes/parse.routes.js
import express from 'express';
import { parseTextController } from '../controllers/voiceController.js';

const router = express.Router();

router.post('/', parseTextController);


router.get('/', (req, res) => {
  res.send('Voice route is working!');
});

export default router;
