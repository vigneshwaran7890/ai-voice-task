import express from 'express';
import { registerUser, getAllUsers } from '../controllers/userController.js';

const router = express.Router();

router.post('/', registerUser); // POST /api/users
router.get('/', getAllUsers);   // GET /api/users

export default router;
