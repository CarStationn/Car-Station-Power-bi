# ============================================================
# API do Portal Car Station — Node 20 (Express 5 exige 18+)
# Nenhuma dependência é nativa (bcryptjs, pg e jsonwebtoken são
# JS puro), então não é preciso build-essential nem python.
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Camada de dependências separada: só reinstala quando o lock muda
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# Não roda como root
USER node

ENV NODE_ENV=production
EXPOSE 3001

# A raiz da API responde "API rodando"; serve de sinal de vida.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
