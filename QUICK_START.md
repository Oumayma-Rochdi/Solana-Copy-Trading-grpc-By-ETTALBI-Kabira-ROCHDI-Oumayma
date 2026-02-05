# Quick Start Guide - Bot IA

Vous êtes pressé? Voici comment démarrer en 5 minutes.

## 1️⃣ Setup Base de Données (2 min)

```bash
# Exporter votre DATABASE_URL
export DATABASE_URL="postgresql://..."

# Créer les tables
psql -d $DATABASE_URL -f scripts/create-ai-analysis-tables.sql

# Vérifier
psql -d $DATABASE_URL -c "\dt ai_*"
```

## 2️⃣ Démarrer le Bot (1 min)

```bash
# Tester rapidement
npm start

# Ou en production
npm install -g pm2
pm2 start index.js --name "solana-bot"
```

## 3️⃣ Accéder au Dashboard (1 min)

```
http://localhost:3000
```

Vous verrez:
- Panneau de contrôle IA
- Historique des analyses
- Statistiques

## 4️⃣ Utiliser l'API (1 min)

```bash
# Analyser le marché
curl -X POST http://localhost:3000/api/ai/analyze-market \
  -H "Content-Type: application/json" \
  -d '{"marketData": {"btcPrice": 42000, "sentiment": "bullish"}}'

# Obtenir des suggestions
curl -X POST http://localhost:3000/api/ai/suggestions \
  -H "Content-Type: application/json" \
  -d '{"marketData": {"btcPrice": 42000}}'
```

## 🔧 Configuration Essentiels

### Variables d'Environnement
```bash
DATABASE_URL=postgresql://user:pass@host/db
ENABLE_DASHBOARD=true
DASHBOARD_PORT=3000
```

### Port
Par défaut: `3000`
Changer:
```bash
DASHBOARD_PORT=8080 npm start
```

## 📊 Fonctionnalités Principales

| Bouton | Fonction |
|--------|----------|
| Analyze Market | Analyser les conditions du marché |
| Get Suggestions | Obtenir des suggestions de trading |
| Risk Assessment | Évaluer le risque du portefeuille |
| Stream | Streaming temps réel |
| Clear History | Nettoyer l'historique |

## 🧪 Valider l'Installation

```bash
# Exécuter les tests
node tests/ai-bot.test.js

# Vérifier la BD
psql -d $DATABASE_URL -c "SELECT COUNT(*) FROM ai_analyses;"

# Vérifier l'API
curl http://localhost:3000/api/ai/statistics
```

## 🚀 Déploiement Rapide

### Vercel
```bash
git push origin main
# Vercel redéploie automatiquement
```

### Self-Hosted
```bash
pm2 start index.js --name "bot"
pm2 save
pm2 startup
```

## 🐛 Problèmes Courants

### "Module not found"
```bash
npm install
```

### "DATABASE_URL not found"
```bash
export DATABASE_URL="..."
npm start
```

### "Port 3000 already in use"
```bash
lsof -i :3000
kill -9 <PID>
```

### "Connection timeout"
- Vérifier DATABASE_URL
- Vérifier l'accès réseau à Neon

## 📚 Documentation Complète

- **Setup détaillé**: `AI_BOT_SETUP.md`
- **Architecture**: `AI_BOT_INTEGRATION.md`
- **Déploiement**: `DEPLOYMENT.md`
- **Résumé**: `IMPLEMENTATION_SUMMARY.md`
- **README**: `AI_BOT_README.md`

## ⚡ Commandes Utiles

```bash
# Démarrer
npm start

# Tests
npm test

# Voir les logs
pm2 logs

# Voir l'historique
curl http://localhost:3000/api/ai/history

# Voir les stats
curl http://localhost:3000/api/ai/statistics

# Nettoyer l'historique
curl -X POST http://localhost:3000/api/ai/clear-history
```

## 🎯 Cas d'Usage Rapides

### Analyser le marché
```javascript
const response = await fetch('/api/ai/analyze-market', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    marketData: {btcPrice: 42000, sentiment: 'bullish'}
  })
});
const data = await response.json();
```

### Obtenir des suggestions
```javascript
const response = await fetch('/api/ai/suggestions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    marketData: {btcPrice: 42000}
  })
});
const suggestions = await response.json();
```

### Évaluer le risque
```javascript
const response = await fetch('/api/ai/risk-assessment');
const assessment = await response.json();
console.log('Risk Score:', assessment.riskScore);
```

## 🔐 Important pour la Production

- [ ] Définir DATABASE_URL
- [ ] Activer HTTPS
- [ ] Configurer les backups
- [ ] Monitorer les logs
- [ ] Limiter le rate limiting si besoin
- [ ] Vérifier les permissions

## 📞 Aide

1. Voir les logs: `npm start`
2. Exécuter les tests: `node tests/ai-bot.test.js`
3. Consulter: `AI_BOT_SETUP.md`
4. Vérifier BD: `psql -d $DATABASE_URL -c "\dt ai_*"`

## ✅ Checklist Démarrage

- [ ] DATABASE_URL défini
- [ ] Tables créées
- [ ] npm start lancé
- [ ] Dashboard accessible
- [ ] API testée
- [ ] Tests passants

**Enjoy! 🚀**
