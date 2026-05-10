import { Router } from 'express';
import { register, login, updateProfile, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);

export default router;
