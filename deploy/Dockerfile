# SPA estatica (Vite/React). O build sai pronto da maquina de dev:
# as VITE_* sao gravadas no bundle em tempo de build, entao nao ha env em runtime.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 80
