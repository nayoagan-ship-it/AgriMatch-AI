FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
ENV NODE_ENV=production DEPLOYMENT_MODE=cloud HOST=0.0.0.0 PORT=8080 PUBLIC_ACCESS=true
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
