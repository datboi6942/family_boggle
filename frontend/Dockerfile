# Build stage
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl

# Generate self-signed SSL certificate
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx-selfsigned.key \
    -out /etc/nginx/ssl/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=FamilyBoggle/CN=192.168.6.98" \
    -addext "subjectAltName=IP:192.168.6.98,DNS:localhost"

COPY --from=build /app/dist /usr/share/nginx/html
# Custom nginx config for SPA routing and WebSocket proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]


