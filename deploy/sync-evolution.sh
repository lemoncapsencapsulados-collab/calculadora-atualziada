#!/usr/bin/env bash
# Empurra da Evolution para o Supabase o que a API dela não entrega.
#
# Roda NA VPS, por cron. Existe porque duas informações só existem no Postgres
# da Evolution e não saem por nenhuma rota REST:
#
#   1. `Chat.labels` — quem está em cada etiqueta. Verificado: 404 nas rotas
#      específicas de label e zero campos de etiqueta em 918 chats varridos.
#   2. O telefone de contatos `@lid`, em `Message.key->>'remoteJidAlt'`. O
#      `@lid` é o identificador novo do WhatsApp e não carrega o número.
#
# O Postgres da Evolution NÃO é exposto para fora da VPS — de propósito, e é
# assim que deve continuar. Por isso quem lê é este script, aqui dentro, e o que
# atravessa a internet é só o resultado, autenticado por segredo compartilhado.
#
# Instalação:
#   /opt/lemon-sync/sync-evolution.sh
#   /opt/lemon-sync/.secret        (chmod 600, mesmo valor de ZAP_SYNC_SECRET)
#   cron: */30 * * * * /opt/lemon-sync/sync-evolution.sh >> /var/log/lemon-sync.log 2>&1

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
URL="https://njfwoguvfozuaghufcgw.supabase.co/functions/v1/zap-sync-evolution"
SECRET_FILE="$DIR/.secret"

[ -r "$SECRET_FILE" ] || { echo "ERRO: $SECRET_FILE ausente ou ilegível"; exit 1; }
SECRET="$(cat "$SECRET_FILE")"

PG="$(docker ps -q -f name=postgres_postgres | head -1)"
[ -n "$PG" ] || { echo "ERRO: container do postgres não encontrado"; exit 1; }

# Só instâncias com conversa. As vazias existem no cadastro e não têm o que
# sincronizar — enviá-las apagaria associação por engano, já que o lado do
# Supabase substitui a base inteira da instância a cada carga.
INSTANCIAS="$(docker exec "$PG" psql -U postgres -d evolution -tAc \
  "select i.name from \"Instance\" i
    where exists (select 1 from \"Chat\" c where c.\"instanceId\" = i.id)")"

# `while read` e não `for`: nome de instância tem espaço ("guilherme magano") e
# a divisão por palavra do shell o quebraria em três, pulando a instância —
# justamente uma das que mais têm etiqueta.
while IFS= read -r NOME; do
  [ -n "$NOME" ] || continue
  # Monta o payload no próprio Postgres: json_agg evita passar milhares de
  # linhas por pipe de shell e reencodá-las.
  PAYLOAD="$(docker exec "$PG" psql -U postgres -d evolution -tAc "
    select json_build_object(
      'instancia', i.name,
      'etiquetas', coalesce((
        select json_agg(json_build_object('label_id', l.\"labelId\", 'nome', l.name, 'cor', l.color))
        from \"Label\" l where l.\"instanceId\" = i.id
      ), '[]'::json),
      'associacoes', coalesce((
        select json_agg(json_build_object(
          'remote_jid', c.\"remoteJid\", 'label_ids', c.labels, 'nome', c.name))
        from \"Chat\" c
        where c.\"instanceId\" = i.id
          and c.labels is not null
          and c.labels::text not in ('null','[]','{}')
      ), '[]'::json),
      -- Nome do contato, de Message.pushName. Sem crase nestes comentarios: o
      -- SQL viaja dentro de aspas duplas do shell, e crase ali vira execucao de
      -- comando -- foi assim que o bloco inteiro quebrou na primeira tentativa.
      -- pushName cobre 782 de 918 conversas, contra 57 em Chat.name e quase
      -- nada em Contact. So de mensagem RECEBIDA: no que o consultor envia, o
      -- pushName e o nome dele proprio.
      'nomes', coalesce((
        select json_agg(n) from (
          select distinct on (m.key->>'remoteJid')
            m.key->>'remoteJid' as remote_jid,
            m.\"pushName\" as nome
          from \"Message\" m
          where m.\"instanceId\" = i.id
            and coalesce((m.key->>'fromMe')::boolean, false) = false
            and m.\"pushName\" is not null
            and m.\"pushName\" !~ '^[0-9]+\$'
          order by m.key->>'remoteJid', m.\"messageTimestamp\" desc
        ) n
      ), '[]'::json),
      'telefones', coalesce((
        select json_agg(t) from (
          select distinct on (m.key->>'remoteJid')
            m.key->>'remoteJid' as remote_jid,
            split_part(m.key->>'remoteJidAlt', '@', 1) as telefone
          from \"Message\" m
          where m.\"instanceId\" = i.id
            and m.key->>'remoteJidAlt' like '%@s.whatsapp.net'
        ) t
      ), '[]'::json)
    )
    from \"Instance\" i where i.name = '$NOME'")"

  [ -n "$PAYLOAD" ] || { echo "[$NOME] payload vazio, pulando"; continue; }

  RESP="$(printf '%s' "$PAYLOAD" | curl -s --max-time 120 -X POST "$URL" \
    -H "x-zap-secret: $SECRET" \
    -H 'Content-Type: application/json' \
    --data-binary @-)"

  echo "$(date -Is) [$NOME] $RESP"
done <<< "$INSTANCIAS"
