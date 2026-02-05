import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { searchQuerySchema } from '../validators/search.validator';

const router = Router();

router.use(authMiddleware);

// GET /search - 全文検索
router.get(
  '/',
  validateQuery(searchQuerySchema),
  searchController.search.bind(searchController)
);

export default router;
