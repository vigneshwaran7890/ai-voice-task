// routes/parse.routes.js
import express from 'express';
import { parseTextController } from '../controllers/voiceController.js';

const router = express.Router();

router.post('/', parseTextController);

export default router;
