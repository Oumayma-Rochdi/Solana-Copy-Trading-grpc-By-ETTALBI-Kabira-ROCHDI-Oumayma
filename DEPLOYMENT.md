# Guide de Déploiement - Bot Intelligent d'Analyse IA

## Vue d'Ensemble

Ce guide explique comment déployer votre bot de trading Solana avec l'intégration IA intelligente sur Vercel ou en self-hosted.

## Prérequis

- Git configuré et repository distant
- Compte Vercel (pour déploiement cloud)
- Neon PostgreSQL configuré
- Node.js 16+ localement

## Option 1: Déploiement sur Vercel (Recommandé)

### Étape 1: Préparer le Repository

```bash
# Vérifier que tout est commité
git status

# Ajouter les nouveaux fichiers
git add services/aiAnalysis.js
git add services/aiPersistence.js
git add dashboard/public/ai-bot.js
git add scripts/create-ai-analysis-tables.sql
git add tests/ai-bot.test.js
git add AI_BOT_SETUP.md
git add AI_BOT_INTEGRATION.md
git add IMPLEMENTATION_SUMMARY.md
git add DEPLOYMENT.md

# Commit
git commit -m "feat: integrate intelligent AI trading bot"

# Push
git push origin main
```

### Étape 2: Créer la Migration Base de Données

Avant de déployer, vous devez créer les tables:

**Option A: Via Neon Console**
1. Aller à neon.tech et se connecter
2. Ouvrir le SQL Editor
3. Copier le contenu de `scripts/create-ai-analysis-tables.sql`
4. Exécuter les requêtes

**Option B: Via Script Local**
```bash
# Télécharger votre DATABASE_URL depuis Vercel
export DATABASE_URL="postgresql://..."

# Exécuter la migration
psql -d $DATABASE_URL -f scripts/create-ai-analysis-tables.sql
```

### Étape 3: Configurer Vercel

1. **Connecter Vercel au Repository**
   - Aller à vercel.com
   - Cliquer "New Project"
   - Sélectionner votre repository GitHub
   - Cliquer "Import"

2. **Ajouter les Variables d'Environnement**
   
   Dans les settings du projet Vercel:
   
   ```
   DATABASE_URL = postgresql://...
   ENABLE_DASHBOARD = true
   DASHBOARD_PORT = 3000
   ```

3. **Connecter Neon** (si nécessaire)
   
   - Dans Vercel, aller à "Integrations"
   - Connecter Neon
   - Sélectionner votre base de données

### Étape 4: Déployer

```bash
# Option 1: Via Vercel CLI
vercel deploy --prod

# Option 2: Via GitHub
# Simplement pousser vers main pour déploiement automatique
git push origin main
```

### Étape 5: Vérifier le Déploiement

1. Aller à votre URL Vercel
2. Vérifier que le dashboard charge
3. Tester les endpoints AI:

```bash
curl -X GET https://your-vercel-url.vercel.app/api/ai/statistics
```

## Option 2: Déploiement Auto-Hébergé

### Étape 1: Préparer le Serveur

```bash
# SSH dans votre serveur
ssh user@your-server.com

# Cloner le repository
git clone https://github.com/Oumayma-Rochdi/Solana-Copy-Trading-grpc.git
cd Solana-Copy-Trading-grpc

# Installer les dépendances
npm install
```

### Étape 2: Configurer les Variables

```bash
# Créer le fichier .env
cat > .env << EOF
DATABASE_URL=postgresql://...
ENABLE_DASHBOARD=true
DASHBOARD_PORT=3000
GRPC_ENDPOINT=...
GRPC_TOKEN=...
EOF

# Protéger le fichier
chmod 600 .env
```

### Étape 3: Créer les Tables

```bash
# Via psql
psql -d $DATABASE_URL -f scripts/create-ai-analysis-tables.sql

# Vérifier la création
psql -d $DATABASE_URL -c "\dt ai_*"
```

### Étape 4: Démarrer le Service

```bash
# Option 1: Démarrage manuel
npm start

# Option 2: Avec PM2 (recommandé pour production)
npm install -g pm2

pm2 start index.js --name "solana-bot"
pm2 save
pm2 startup

# Voir les logs
pm2 logs solana-bot
```

### Étape 5: Configurer Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer la configuration:
```bash
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Étape 6: Configurer SSL (Let's Encrypt)

```bash
# Installer certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot certonly --nginx -d your-domain.com

# Configurer le renouvellement automatique
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Configuration de Production

### Checklist de Sécurité

- [ ] DATABASE_URL sécurisé (ne pas commiter)
- [ ] Rate limiting activé sur les endpoints
- [ ] Logs centralisés (Vercel, Sentry, etc.)
- [ ] Backups de base de données configurés
- [ ] SSL/HTTPS activé
- [ ] Firewall configuré
- [ ] Monitoring en place

### Monitoring et Alertes

#### Vercel Monitoring
```bash
# Voir les logs en direct
vercel logs --follow
```

#### Self-Hosted Monitoring
```bash
# Installer pm2-monitoring
pm2 install pm2-auto-pull

# Voir les ressources
pm2 monit
```

### Backups Base de Données

#### Automatisé avec Neon
Neon sauvegarde automatiquement chaque heure. Vérifier:
- neon.tech → Backups tab
- Vérifier la rétention

#### Manuel
```bash
# Exporter
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Importer
psql $DATABASE_URL < backup_20260205.sql
```

## Mise à Jour du Code

### Déployer une Mise à Jour

```bash
# Sur votre machine locale
git pull origin main

# Si changements de schéma BD
npm run migrate

# Commit et push
git add .
git commit -m "chore: update ai bot"
git push origin main

# Vercel redéploie automatiquement
```

### Rollback en cas de Problème

```bash
# Vercel: Cliquer "Deployments" → Sélectionner une version précédente

# Self-hosted: 
git revert HEAD
npm start
```

## Tester le Déploiement

### Tests de Fonctionnalité

```bash
# 1. Dashboard accessible
curl -I https://your-domain.com

# 2. AI Analysis fonctionne
curl -X POST https://your-domain.com/api/ai/analyze-market \
  -H "Content-Type: application/json" \
  -d '{"marketData": {"btcPrice": 42000}}'

# 3. Base de données connectée
curl -X GET https://your-domain.com/api/ai/statistics

# 4. Suite de tests
npm test
```

### Performance Load Testing

```bash
# Installer apache-bench
sudo apt-get install apache2-utils

# Tester 100 requêtes, 10 parallèles
ab -n 100 -c 10 https://your-domain.com/api/ai/statistics
```

## Troubleshooting Déploiement

### Vercel

**Erreur: Module not found**
```bash
# Vérifier package.json
cat package.json | grep -E '"ai":|"@ai-sdk'

# Réinstaller dépendances
rm -rf node_modules package-lock.json
npm install
```

**Erreur: DATABASE_URL undefined**
- Vérifier les variables d'environnement dans Vercel
- Attendre 5 minutes après les avoir ajoutées
- Redéployer

**Erreur: 502 Bad Gateway**
- Vérifier les logs: `vercel logs --follow`
- Vérifier que la base de données est accessible
- Vérifier le port (3000 par défaut)

### Self-Hosted

**PM2 ne redémarre pas le service**
```bash
# Vérifier le status
pm2 status

# Redémarrer manuellement
pm2 restart solana-bot

# Vérifier les erreurs
pm2 error solana-bot
```

**Connexion BD timeout**
```bash
# Vérifier la connexion
psql -d $DATABASE_URL -c "SELECT version();"

# Vérifier les logs PostgreSQL
sudo journalctl -u postgresql -n 50
```

**Port 3000 déjà utilisé**
```bash
# Trouver le processus
lsof -i :3000

# Terminer le processus
kill -9 PID

# Ou changer le port
DASHBOARD_PORT=3001 npm start
```

## Performance en Production

### Optimisations Recommandées

1. **Caching Redis** (optionnel)
   ```bash
   npm install redis ioredis
   # Implémenter la mise en cache des analyses
   ```

2. **CDN pour Assets Statiques**
   - Ajouter Cloudflare pour la compression
   - Cache des assets du dashboard

3. **Database Connection Pooling**
   - Déjà implémenté dans aiPersistence.js
   - Ajuster pool.max selon la charge

4. **Compression des Réponses**
   - Déjà activée avec `compression()` middleware
   - Vérifier dans les headers de réponse

### Métriques à Surveiller

```javascript
// Monitorer dans les logs
[AI-Analysis] Average response time: XXms
[AI-Persistence] Query time: XXms
[Dashboard] Request rate: XX req/min
[Error Rate] < 1% acceptable
```

## Checklist Final

### Avant de Mettre en Production

- [ ] Code commité et testé localement
- [ ] Variables d'environnement configurées
- [ ] Migration BD exécutée
- [ ] Suite de tests réussie
- [ ] Backup BD configuré
- [ ] Monitoring et logs en place
- [ ] SSL/HTTPS activé
- [ ] Rate limiting vérifié
- [ ] Documentation accessible
- [ ] Équipe informée de la déploiement

### Après le Déploiement

- [ ] Tester tous les endpoints
- [ ] Vérifier les logs
- [ ] Confirmer la persistance BD
- [ ] Tester le dashboard
- [ ] Vérifier les alertes
- [ ] Documenter les accès
- [ ] Former l'équipe

## Contacter le Support

En cas de problème lors du déploiement:

1. Vérifier les logs: `vercel logs` ou `pm2 logs`
2. Consulter la documentation: `AI_BOT_SETUP.md`
3. Exécuter les tests: `npm test`
4. Vérifier la base de données via Neon console

## Ressources Supplémentaires

- **Vercel Docs**: https://vercel.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/nodejs-performance/
- **PM2 Guide**: https://pm2.keymetrics.io/docs/

---

Bonne chance avec votre déploiement! 🚀
