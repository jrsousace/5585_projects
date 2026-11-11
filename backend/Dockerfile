FROM node:18-alpine

# Cria e define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala apenas as dependências de produção
RUN npm install --only=production

# Copia o restante do código do backend
COPY . .

# Expõe a porta que o Cloud Run vai usar
EXPOSE 3000

# Comando para iniciar o servidor
CMD [ "npm", "start" ]