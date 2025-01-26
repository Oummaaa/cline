# Arguments de construction
ARG NODE_VERSION=18

# Étape de construction
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN ls -l /app
COPY . .
RUN ls -l /app
RUN cd webview-ui && npm install
RUN ls -l webview-ui
RUN npm run package

# Étape finale
FROM codercom/code-server:latest

# Labels pour la maintenance
LABEL maintainer="Cline Development Team" \
      version="1.0.0" \
      description="Environment de développement Cline avec code-server"

USER root

# Installer les dépendances système et navigateurs
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git \
    curl \
    zsh \
    firefox-esr \
    chromium \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    python3 \
    python3-pip \
    default-jdk \
    build-essential \
    vim \
    git-lfs && \
    # Installer Node.js et npm
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    # Installer les outils JS globaux avec versions spécifiques
    npm install -g @angular/cli@16.2.10 create-react-app@5.0.1 typescript@5.3.3 && \
    npm cache clean --force && \
    # Configurer zsh
    chsh -s /usr/bin/zsh coder && \
    # Configurer code-server
    mkdir -p /home/coder/.vscode-server/data/Machine && \
    echo '{"terminal.integrated.defaultProfile.linux": "zsh"}' > /home/coder/.vscode-server/data/Machine/settings.json && \
    chown -R coder:coder /home/coder/.vscode-server && \
    # Configurer Git
    git config --system credential.helper store && \
    git config --system init.defaultBranch main && \
    # Nettoyer
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Créer et configurer le dossier workspace
RUN mkdir -p /workspace && \
    chown -R coder:coder /workspace

# Copier l'extension construite
COPY --from=builder /app /home/coder/cline
WORKDIR /home/coder/cline

# Installer les extensions VSCode nécessaires
RUN code-server --install-extension ms-vscode.vscode-typescript-next \
    --install-extension ms-python.python \
    --install-extension redhat.java \
    --install-extension dbaeumer.vscode-eslint \
    --install-extension dsznajder.es7-react-js-snippets

# Variables d'environnement
ENV PASSWORD=cline123
EXPOSE 8088 3000 4200 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8088 || exit 1

# Démarrer code-server avec l'extension pré-chargée
CMD ["code-server", "--bind-addr", "0.0.0.0:8088", "/home/coder/cline"]
