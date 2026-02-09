import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from Front-end folder
app.use(express.static(path.join(__dirname, '../Front-end')));

// Routes for HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Front-end/index.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../Front-end/home.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// MongoDB connection
console.log('🔍 Checking .env file...');
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/neurosense';

console.log('📡 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB successfully!'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    birthdate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// === API ROUTES ===

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                birthdate: user.birthdate || '',
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                birthdate: user.birthdate || '',
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user
app.put('/api/users/update', authMiddleware, async (req, res) => {
    try {
        const { name, email, phone, birthdate, currentPassword, newPassword } = req.body;
        
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update basic info
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (birthdate) user.birthdate = birthdate;
        
        // Update password if provided
        if (currentPassword && newPassword) {
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
        }
        
        await user.save();
        
        res.json({
            message: 'User updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                birthdate: user.birthdate || '',
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Progress routes
app.get('/api/progress', authMiddleware, async (req, res) => {
    try {
        res.json({
            mentalHealthScore: 75,
            assessmentsCompleted: 3,
            lastAssessmentDate: new Date().toISOString(),
            progressHistory: [
                { date: '2024-01-01', score: 65 },
                { date: '2024-01-15', score: 70 },
                { date: '2024-02-01', score: 75 }
            ]
        });
    } catch (error) {
        console.error('Progress error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Handle 404 for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
==================================================
✅ Server running at http://localhost:${PORT}
✅ Health check: http://localhost:${PORT}/api/health
✅ Frontend: http://localhost:${PORT}/
✅ Register: POST http://localhost:${PORT}/api/auth/register
✅ Login: POST http://localhost:${PORT}/api/auth/login
==================================================
    `);
});