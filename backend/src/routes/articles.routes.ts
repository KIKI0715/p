import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listArticles,
  getArticle,
  updateArticle,
  deleteArticle,
  publishToDev,
} from '../controllers/articles.controller';

const router = Router();

router.use(authenticate);

router.get('/', listArticles);
router.get('/:id', getArticle);
router.put('/:id', updateArticle);
router.delete('/:id', deleteArticle);
router.post('/:id/publish', publishToDev);

export default router;
