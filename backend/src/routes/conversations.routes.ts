import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  sendMessage,
  generateArticleFromConversation,
} from '../controllers/conversations.controller';

const router = Router();

router.use(authenticate);

router.get('/', listConversations);
router.post('/', createConversation);
router.get('/:id', getConversation);
router.delete('/:id', deleteConversation);
router.post('/:id/messages', sendMessage);
router.post('/:id/generate-article', generateArticleFromConversation);

export default router;
