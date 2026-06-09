const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Session + Passport for Google OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport user serialization (store minimal profile)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  }, (accessToken, refreshToken, profile, cb) => {
    // profile contains user info from Google
    return cb(null, { id: profile.id, displayName: profile.displayName, photos: profile.photos });
  }));
  console.log('Google OAuth configured.');
} else {
  console.log('Google OAuth not configured. Skipping Passport GoogleStrategy registration.');
}

const API_BASE_URL = 'https://generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let selectedModelName = null;

async function findModelName() {
  const url = `${API_BASE_URL}/${API_VERSION}/models?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`ListModels failed: ${response.status} ${data.error?.message || JSON.stringify(data)}`);
  }

  const models = data.models || [];
  const preferredModel = models.find((model) => model.name === 'gemini-1.5-flash' && Array.isArray(model.supportedMethods) && model.supportedMethods.includes('generateContent'));
  if (preferredModel) {
    return preferredModel.name;
  }

  const supportedModel = models.find((model) => Array.isArray(model.supportedMethods) && model.supportedMethods.includes('generateContent'));
  if (supportedModel) {
    return supportedModel.name;
  }
  if (models.length > 0) {
    return models[0].name;
  }
  throw new Error('No available models found from the API');
}

// Helper: call model with retries and exponential backoff for transient errors
async function callModelWithRetry(model, input, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await model.generateContent(input);
      return result;
    } catch (err) {
      const msg = err?.message || '';
      const status = err?.status || err?.statusCode || (err?.response && err.response.status);
      const retryable = status === 503 || status === 429 || /Service Unavailable/i.test(msg) || /rate limit/i.test(msg) || /temporar/i.test(msg);
      console.warn(`[ModelCall] attempt ${i + 1} failed`, status || msg);
      if (i === attempts - 1 || !retryable) {
        throw err;
      }
      // exponential backoff
      const delay = 500 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Ruta para chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta la clave GEMINI_API_KEY en .env' });
    }

    if (!selectedModelName) {
      if (process.env.PREFERRED_MODEL) {
        selectedModelName = process.env.PREFERRED_MODEL;
        console.log('Using preferred model from env:', selectedModelName);
      } else {
        selectedModelName = await findModelName();
        console.log('Modelo seleccionado:', selectedModelName);
      }
    }

    const model = genAI.getGenerativeModel({ model: selectedModelName }, { apiVersion: API_VERSION });
    const result = await callModelWithRetry(model, message, 4);
    const response = result.response;
    const text = response.text ? response.text() : (response?.toString ? response.toString() : JSON.stringify(response));

    res.json({ response: text });
  } catch (error) {
    const errorMessage = error?.message || 'Error al procesar el mensaje';
    console.error('Error:', errorMessage, error);
    res.status(500).json({ error: errorMessage });
  }
});

// --- Google OAuth routes (register only if credentials provided) ---
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      // Successful authentication, redirect home.
      res.redirect('/');
    }
  );
} else {
  // provide a helpful route that informs the developer
  app.get('/auth/google', (req, res) => res.status(501).send('Google OAuth not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'));
}

app.get('/api/me', (req, res) => {
  if (req.user) return res.json({ user: req.user });
  return res.json({ user: null });
});

app.post('/api/logout', (req, res) => {
  req.logout(() => {});
  req.session.destroy(() => res.json({ ok: true }));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
