# Build da aplicação frontend (React/Node)
FROM node:20-alpine AS build

WORKDIR /app

# Copia configs de dependência
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia restante do código
COPY . .

# Gera build de produção (ajuste se seu script tiver outro nome)
RUN npm run build

# --------- Runtime ----------
FROM node:20-alpine

WORKDIR /app

# Copia apenas o build gerado
COPY --from=build /app/build ./build

# Se usar "serve" pra servir o build estático:
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
