#!/usr/bin/env bash
# Deploy da Calculadora para a VPS (Docker Swarm + Traefik).
#
# A stack "calculadora" e' isolada das outras que rodam na mesma maquina
# (lemonlog, kit, n8n, evolution, postgres, portainer, traefik): namespace
# proprio, imagem propria, router Traefik proprio. Roteia por Host header,
# entao nao disputa porta com ninguem.
#
# Uso: ./deploy.sh
set -euo pipefail

VPS_HOST="root@177.7.39.163"
SSH_KEY="$HOME/.ssh/lemon_deploy"
REMOTE_DIR="/opt/calculadora"
SERVICE="calculadora_calculadora"
DOMAIN="calculadora.lemoncapsauto.com"
EXPECTED_REF="njfwoguvfozuaghufcgw"   # projeto Supabase que o bundle DEVE apontar

cd "$(dirname "$0")"
TAG="$(date +%Y%m%d-%H%M%S)"
ssh_vps() { ssh -i "$SSH_KEY" -o BatchMode=yes "$VPS_HOST" "$@"; }

echo "==> 1/5  Build local"
npm run build

echo "==> 2/5  Conferindo o bundle"
# As VITE_* sao gravadas no bundle em tempo de build. Se o .env estiver errado,
# o deploy sobe um app apontando pro Supabase errado -- por isso barramos aqui.
novas=$(grep -rho "$EXPECTED_REF" dist/assets/*.js | wc -l)
[ "$novas" -gt 0 ] || { echo "ERRO: bundle nao referencia $EXPECTED_REF. Confira o .env."; exit 1; }
echo "    ok: $novas referencias a $EXPECTED_REF"

echo "==> 3/5  Enviando para $VPS_HOST:$REMOTE_DIR"
tar -czf - dist -C deploy Dockerfile nginx.conf stack.yml \
  | ssh_vps "mkdir -p $REMOTE_DIR && rm -rf $REMOTE_DIR/dist && tar -xzf - -C $REMOTE_DIR"

echo "==> 4/5  Build da imagem e deploy da stack"
# stack deploy (e nao service update) para que mudancas no stack.yml
# -- update_config, labels do Traefik -- entrem junto com a imagem nova.
ssh_vps "cd $REMOTE_DIR   && docker build -q -t calculadora:$TAG -t calculadora:latest .   && TAG=$TAG docker stack deploy -c stack.yml calculadora --detach=false" 2>&1 | tail -4

echo "==> 5/5  Verificando"
# O provider do Traefik recarrega a cada ~15s. Mesmo com start-first, damos
# margem antes de considerar o deploy quebrado.
ok=0
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:177.7.39.163" "https://$DOMAIN/" || true)
  tls=$(curl -s -o /dev/null -w '%{ssl_verify_result}' --resolve "$DOMAIN:443:177.7.39.163" "https://$DOMAIN/" || true)
  if [ "$code" = "200" ] && [ "$tls" = "0" ]; then
    echo "    HTTP 200 | TLS valido (tentativa $i)"; ok=1; break
  fi
  echo "    aguardando Traefik... (HTTP ${code:-?}, tentativa $i/12)"; sleep 5
done
[ "$ok" = "1" ] || { echo "ERRO: site nao respondeu 200 apos 60s"; exit 1; }

echo
echo "OK  https://$DOMAIN  (imagem calculadora:$TAG)"
