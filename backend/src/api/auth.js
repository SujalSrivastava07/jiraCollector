import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { logger } from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev';

// Register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create a new Tenant for the user
    const tenant = new Tenant({
      name: `${email.split('@')[0]}'s Workspace`
    });
    await tenant.save();

    // Create User linked to the Tenant
    const user = new User({
      email,
      password,
      tenantId: tenant._id
    });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, tenantId: tenant._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info({ userId: user._id }, 'New user registered');
    res.status(201).json({ token, tenantId: tenant._id, email: user.email });
  } catch (error) {
    console.error("RAW REGISTRATION ERROR:", error);
    logger.error({ error }, 'Registration error');
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info({ userId: user._id }, 'User logged in');
    res.json({ token, tenantId: user.tenantId, email: user.email });
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mock connections for Onboarding
authRouter.post('/github/mock-connect', requireAuth, async (req, res) => {
  try {
    const { tenantId, installationId } = req.body;
    let tenant = await Tenant.findById(tenantId);
    if (tenant) {
      tenant.githubInstallationId = installationId;
      await tenant.save();
    }
    res.json({ message: 'GitHub connected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect GitHub' });
  }
});

authRouter.post('/jira/mock-connect', requireAuth, async (req, res) => {
  try {
    const { tenantId, cloudId } = req.body;
    let tenant = await Tenant.findById(tenantId);
    if (tenant) {
      tenant.jiraCloudId = cloudId;
      await tenant.save();
    }
    res.json({ message: 'Jira connected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect Jira' });
  }
});

authRouter.get('/tenant/:id', requireAuth, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (tenant) {
      res.json(tenant);
    } else {
      res.status(404).json({ error: 'Tenant not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});
