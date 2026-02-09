import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getUserProfile } from '../controllers/userController.js';

const router = express.Router();

// ✅ الراوت الأساسي
router.get('/', (req, res) => {
  res.json({ 
    message: 'User routes working',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login', 
      getProfile: 'GET /api/users/profile',  // عدلت المسار
      getMe: 'GET /api/auth/me'
    }
  });
});

// ✅ route البروفايل الجديد
router.get('/profile', protect, getUserProfile);

export default router;