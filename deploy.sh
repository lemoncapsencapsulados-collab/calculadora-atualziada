#!/usr/bin/env bash
# Deploy da Calculadora para a VPS (Docker Swarm + Traefik).
#
# A stack "calculadora" e' isolada das outras que rodam na mesma maquina
# (lemonlog, kit, n8n, evolution, postgres, portainer, traefik): namespace
# proprio, imagem propria, router Traefik proprio. Roteia por Host header,
# entao nao disputa porta com ninguem.
#
# Uso: ./deploy.sh              (com as travas de seguranca)
#      ./deploy.sh --sem-travas  (pula a checagem do git; use so' se souber)
set -euo pipefail

VPS_HOST="root@177.7.39.163"
SSH_KEY="$HOME/.ssh/lemon_deploy"
REMOTE_DIR="/opt/calculadora"
SERVICE="calculadora_calculadora"
DOMAIN="calculadora.lemoncaps.com.br"
DOMAIN_LEGADO="calculadora.lemoncapsauto.com"
EXPECTED_REF="njfwoguvfozuaghufcgw"   # projeto Supabase que o bundle DEVE apontar

cd "$(dirname "$0")"
TAG="$(date +%Y%m%d-%H%M%S)"
ssh_vps() { ssh -i "$SSH_KEY" -o BatchMode=yes "$VPS_HOST" "$@"; }

SEM_TRAVAS=0
[ "${1:-}" = "--sem-travas" ] && SEM_TRAVAS=1

# ---------------------------------------------------------------------------
# Trava de seguranca: o deploy sobe a ARVORE DE TRABALHO, nao o que esta' no
# git. Duas pessoas deployando de copias diferentes se sobrescrevem, e quem
# sobe por ultimo vence -- mesmo com codigo velho. Ja' aconteceu duas vezes.
# ---------------------------------------------------------------------------
if [ "$SEM_TRAVAS" = "0" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> 0/5  Conferindo o repositorio"
  BRANCH="$(git branch --show-current)"

  # Alteracao real nao commitada: o que subiria nao esta' em lugar nenhum.
  # `--ignore-cr-at-eol` porque esta arvore troca de CRLF para LF sozinha
  # (iCloud/Windows) e isso nao e' mudanca de conteudo.
  if ! git diff --quiet --ignore-cr-at-eol HEAD 2>/dev/null; then
    echo "ERRO: ha alteracoes nao commitadas."
    git diff --stat --ignore-cr-at-eol HEAD | tail -8
    echo
    echo "Commite antes de subir, ou rode: ./deploy.sh --sem-travas"
    exit 1
  fi

  # Atrasado em relacao ao remoto: alguem empurrou trabalho que voce nao tem,
  # e subir daqui apagaria o dele da producao.
  REMOTO="$(git config "branch.$BRANCH.remote" || echo '')"
  # O ramo remoto nem sempre tem o nome do local -- quem manda e' branch.*.merge.
  RAMO_REMOTO="$(git config "branch.$BRANCH.merge" 2>/dev/null | sed 's#^refs/heads/##')"
  [ -z "$RAMO_REMOTO" ] && RAMO_REMOTO="$BRANCH"
  ALVO="$REMOTO/$RAMO_REMOTO"
  if [ -n "$REMOTO" ] && git fetch --quiet "$REMOTO" "$RAMO_REMOTO" 2>/dev/null; then
    ATRAS="$(git rev-list --count "HEAD..$ALVO" 2>/dev/null || echo 0)"
    if [ "${ATRAS:-0}" -gt 0 ]; then
      echo "ERRO: sua copia esta $ATRAS commit(s) atras de $ALVO."
      git log --oneline "HEAD..$ALVO" | head -5
      echo
      echo "Rode 'git pull' antes de subir, ou: ./deploy.sh --sem-travas"
      exit 1
    fi
    FRENTE="$(git rev-list --count "$ALVO..HEAD" 2>/dev/null || echo 0)"
    [ "${FRENTE:-0}" -gt 0 ] && echo "    aviso: $FRENTE commit(s) ainda nao enviados ao $REMOTO"
    echo "    ok: $BRANCH em dia com $ALVO"
  else
    echo "    aviso: nao deu para conferir o remoto (sem rede ou sem upstream)"
  fi
fi

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
# O dominio antigo continua roteado; conferir evita derrubar quem ainda o usa.
code_legado=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$DOMAIN_LEGADO:443:177.7.39.163" "https://$DOMAIN_LEGADO/" || true)
if [ "$code_legado" = "200" ]; then
  echo "    $DOMAIN_LEGADO tambem respondendo (HTTP 200)"
else
  echo "    AVISO: $DOMAIN_LEGADO respondeu HTTP ${code_legado:-?}"
fi

echo "OK  https://$DOMAIN  (imagem calculadora:$TAG)"
