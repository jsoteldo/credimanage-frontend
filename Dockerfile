# Etapa 1: Compilación de la aplicación Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar manifiestos
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Argumento opcional para la URL de la API durante la compilación
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Compilar producción Vite
RUN npm run build

# Etapa 2: Servidor Nginx ultra-ligero para Cloud Run
FROM nginx:alpine

# Copiar configuración Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefactos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
