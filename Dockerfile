# SS PHOTOGRAPHY — PRODUCTION DOCKERFILE FOR GOOGLE CLOUD RUN
# Fully containerized Next.js 14 + ONNX Runtime (YuNet + SFace) + Sharp

FROM node:20-slim AS base
WORKDIR /app

# Install native dependencies required for Sharp and ONNX Runtime on Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    libstdc++6 \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Copy built application and neural network ONNX models
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/models ./models
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080

CMD ["npm", "start"]
