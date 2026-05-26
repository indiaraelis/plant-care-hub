# Plant Care Hub — Roadmap

## Fases concluídas

- [x] **Fase 1** — Reorganização de arquivos, remoção de código morto e console.logs
- [x] **Fase 2** — Rate limiting no endpoint de login (express-rate-limit)
- [x] **Fase 3** — AuthContext + endpoint `/api/auth/me` para verificação de sessão
- [x] **Fase 4** — PrivateRoute protegendo rotas autenticadas
- [x] **Fase 5** — Interceptor Axios centralizando tratamento de 401
- [x] **Fase 6** — express-validator + middleware centralizado de erros, controllers refatorados
- [x] **Fase 7** — Migração para Tailwind CSS v3, substituição de inline styles
- [x] **Fase 8** — Badges de status de rega/adubação e banner de alertas no dashboard
- [x] Texto introdutório da página de login simplificado (tagline concisa)

---

## Decisões de design

| Onde | O que usar |
|---|---|
| Mensagens, toasts, estados vazios | Emoji com moderação |
| Botões e navegação | Ícones Lucide |
| Badge de urgência (rega atrasada etc.) | Ícone Lucide + cor |
| Cards de planta | Foto real da planta |
| Títulos de tela | Sem emoji — o texto carrega sozinho |

Emojis são inadequados em títulos e botões: perdem nitidez em telas Retina e têm acessibilidade ruim (leitores de tela leem o nome do emoji no meio da frase).

---

## Fase 8 — Alertas de rega (core do app) ✅
> Entrega o valor que o app já promete. Zero dependência externa.

- [x] Calcular `nextWateringDate = lastWatered + wateringFrequencyDays` no frontend
- [x] Badge colorido em cada card: atrasada / hoje / em dia
- [x] Banner no topo do dashboard listando as urgentes do dia
- [x] Mesma lógica para adubação (`lastFertilized + fertilizingFrequencyDays`)

## Fase 9 — Reformulação do formulário "Adicionar Planta" ✅
> Reduz fricção no cadastro, corrige campos confusos e alinha com o modelo de dados real.

**Estrutura**
- [x] Fluxo em 2 passos: passo 1 = identificação da planta (autocomplete/foto/manual), passo 2 = frequências e cuidados
- [x] Remover o toggle entre autocomplete e lista simples — sempre autocomplete, busca Trefle em background silencioso
- [x] Remover o checkbox "incluir busca internacional" da interface

**Campos**
- [x] Campo "Frequência de Rega" vira opções rápidas: A cada 2 dias / Semanal / Quinzenal / Mensal + campo livre
- [x] Campo "Frequência de Adubação" vira: checkbox "Não precisa de adubação" que esconde o campo quando marcado
- [x] Campo "Espécie" somente leitura (ou oculto) quando preenchido via autocomplete
- [x] Adicionar campo "Data de aquisição" (existe no model, mas não aparecia no form)
- [x] Adicionar campo "Última rega" no cadastro (evita edição logo após criar)
- [x] Adicionar campo "Localização" (sala, varanda, quarto, escritório) — mesmo campo do Fase 10

**Textos e labels**
| Atual | Corrigido |
|---|---|
| "Adicionar Nova Planta" | "Nova planta no jardim" |
| "Detalhes da Sua Planta" | "Como você cuida dela?" |
| "Notas (opcional)" | "Alguma observação? Onde ela fica, comportamento, etc." |
| "Adicionar Planta" (botão) | "Adicionar ao jardim" |
| "Voltar para o Dashboard" | "Voltar" |
| "Frequência de Adubação (dias - 0 para não adubar)" | checkbox + campo numérico somente quando necessário |

## Fase 10 — Botão "Reguei agora" + histórico ✅
> Interação central do app. Requer mudança no Model e nova rota.

- [x] Adicionar `wateringHistory: [Date]` e `fertilizingHistory: [Date]` no `Plant.js`
- [x] Nova rota `PATCH /api/plants/:id/water` (e `/fertilize`) — atualiza `lastWatered` e faz push no array
- [x] Botão "Reguei" diretamente no card (sem abrir edição), com feedback toast
- [x] Botão "Adubei" com a mesma lógica

## Fase 11 — Dashboard em grid + filtros ✅
> UX que escala com muitas plantas. Depende dos badges da Fase 8.

- [x] Refatorar layout do dashboard: lista → grid de cards (2 colunas mobile, 3 desktop)
- [x] Campo `location` no model (sala, varanda, quarto, escritório) — opcional
- [x] Barra de busca por nome no dashboard
- [x] Filtros rápidos: "Todas" / "Atrasadas" / "Hoje" / por cômodo
- [x] Mensagem com personalidade no dashboard vazio

## Fase 11.5 — Sugestões de cuidado a partir dos dados botânicos ✅
> Gap: o app ignora os dados que já tem. Quando o usuário seleciona "Ata-de-cobra" da base local — que já tem `origem`, `habito`, `familia` — o formulário abre em branco. A planta já sabe como quer ser cuidada.

**O que deveria acontecer**

Ao selecionar uma planta da base local, o formulário deveria:
1. Exibir uma descrição curta acima dos campos — origem, curiosidade — pra dar contexto afetivo
2. Pré-sugerir a frequência de rega baseada no hábito da planta, deixando o usuário confirmar ou ajustar
3. Pré-marcar adubação com base no que se sabe da espécie

Exemplo de fluxo ideal:
> *"Ata-de-cobra — frutífera nativa do Cerrado"*
> *"Plantas como essa geralmente preferem rega quinzenal. Você pode ajustar abaixo."*
> [Quinzenal já selecionado, usuário pode trocar]

**Implementação — sem mexer no banco**

A `PlantDatabase.js` tem `origem`, `habito`, `familia` mas não tem `regas_sugeridas`. Dá pra derivar pelo hábito com uma função simples no frontend:

| Hábito | Sugestão de rega |
|---|---|
| Árvore nativa Cerrado/Caatinga | Quinzenal (14 dias) |
| Suculenta / cacto | Mensal (30 dias) |
| Tropical úmida | Semanal (7 dias) |
| Herbácea / tempero | A cada 2 dias |
| Padrão (desconhecido) | Semanal (7 dias) |

- [x] Criar função `suggestCareFromHabit(habito, origem)` em `utils/careDefaults.js`
- [x] No `AddPlant.js`, quando uma planta é selecionada via autocomplete, chamar a função e pré-preencher os campos de frequência
- [x] Exibir card informativo acima do form com `origem` + `habito` da planta selecionada
- [x] Deixar claro que é sugestão — texto abaixo do campo: *"Sugestão baseada no hábito da espécie. Ajuste conforme seu ambiente."*

## Fase 11.6 — Sugestão de cuidados via Gemini para plantas externas ✅
> Fecha o fluxo completo: quando a planta não está na base local (vem do Trefle ou é digitada manualmente), o passo 2 não abre mais em branco.

- [x] Novo endpoint `POST /api/suggest-care` — recebe `{ name, species }`, chama Gemini 1.5 Flash com prompt text-only, retorna `{ suggestedWateringDays, suggestedFertilizingDays, careHint, confident }`
- [x] Botão "Sugerir com IA" (ícone Sparkles) no passo 2 do AddPlant — aparece apenas quando não há sugestão e a planta não veio da base local
- [x] Aplica automaticamente os valores sugeridos nas opções rápidas de rega/adubação

**Fase futura — fontes externas de cuidado**

Duas opções com trade-offs honestos:

| Fonte | O que oferece | Confiável? |
|---|---|---|
| **Perenual API** | `watering_general_benchmark` em dias, nível de luz, toxicidade | Média — empresa privada, sem metodologia publicada |
| **Gemini** | Síntese de múltiplas fontes (RHS, Missouri Botanical Garden), em português, contextualizado pro Brasil | Alta quando bem promtado — citar fontes no prompt |

Recomendação: Perenual pra dados estruturados + Gemini pra parágrafo explicativo. Sempre exibir como **sugestão**, não prescrição — com campo editável e frase: *"Ajuste conforme seu ambiente, vaso e estação."* Isso é mais verdadeiro botanicamente do que qualquer dado fixo.

## Fase 12 — Autenticação robusta + conta ✅
> Features de confiança.

- [x] Aumentar JWT para 7 dias
- [x] `PATCH /api/auth/password` — alterar senha (verifica senha atual)
- [x] `DELETE /api/auth/account` — deleta conta + todas as plantas
- [x] Página `/account` com formulário de troca de senha e zona de exclusão
- [x] Ícone de engrenagem no dashboard ligando para `/account`
- [x] Corrigir `Register.js`: chamar `login()` direto após registro
- [x] Recuperação de senha via email (Nodemailer + SHA-256 token + expiração de 1h)

## Fase 13 — Identificação por imagem (Gemini) ✅
> Wow factor. Chave da API fica 100% no backend.

- [x] Rota `POST /api/identify` — recebe imagem em base64, chama Gemini 1.5 Flash, retorna JSON estruturado
- [x] Botão "Identificar por foto" no `AddPlant.js` — abre câmera ou galeria (campo `capture="environment"`)
- [x] Pré-preenchimento automático: nome, espécie, frequência de rega, adubação, hint de cuidado
- [x] Trata resposta incerta (`confident: false`) com toast de aviso e fallback manual
- [x] `GEMINI_API_KEY` necessária em `backend/.env` para funcionar

## Fase 14 — PWA + notificações ✅
> Transforma em app nativo no celular.

- [x] `manifest.json` atualizado: nome, tema verde, `start_url=/dashboard`, orientação portrait
- [x] `index.html` atualizado: `lang=pt-BR`, título, apple-touch meta tags, theme-color verde
- [x] Service Worker registrado manualmente (`public/service-worker.js`) — cache-first para assets, network-first para API
- [x] `useNotifications` hook — pede permissão, verifica plantas urgentes e dispara notificação nativa
- [x] Botão Bell/BellOff no header do dashboard — toggle com badge verde quando ativo

## Fase 15 — Histórico visual + estatísticas ✅
> Satisfação e retenção. Depende do histórico da Fase 10.

- [x] Calendário heatmap na página de detalhes da planta (estilo GitHub contributions) com `wateringHistory`
- [x] Tela "Meu Jardim" (`/stats`): total de plantas, regas esse mês, planta mais antiga, sequência atual (streak), bar de atividade por planta
- [x] Ampliar base local: +51 plantas domésticas comuns → 130 total (Monstera, Pothos, Orquídea, Samambaia, Cacto, ZZ Plant, Ficus, etc.)
- [x] Página de detalhe da planta (`/plants/:id`) com heatmap de 26 semanas, botões de ação, link de edição
- [x] Cards do Dashboard linkados ao detalhe; ícone de estatísticas no cabeçalho

## Fase 16 — Features especiais ✅
> Diferenciação. Implementar após o core estar sólido.

- [x] **Modo viagem** (`/viagem`): datas de saída/retorno → grupos "regar antes de sair", "precisa de cuidado durante ausência", "em dia" + **Web Share API** (WhatsApp/Telegram/etc.) com fallback clipboard
- [x] **Voz e personalidade**: empty state do dashboard, mensagem de exclusão, NotFound, botão "+ Nova planta", toasts com charme
- [x] **Foto da planta**: upload JPEG/PNG/WebP via multer → Cloudinary (5 MB limit, 800px crop); thumbnail no card do dashboard; hero na página de detalhe; botão "Foto" / "Trocar foto" na tela de edição; campo `photoUrl` no modelo Plant
- [x] **Foto da identificação Gemini → guardar**: checkbox "Usar a foto da identificação como foto da planta" no passo 2 do AddPlant; upload automático no submit
- [x] **`frequencyChangedAt`**: campo `Date` no modelo Plant, preenchido automaticamente no `PATCH /:id` quando `wateringFrequencyDays` ou `fertilizingFrequencyDays` muda — preserva contexto para análises futuras do histórico

## Fase 17 — Onboarding do primeiro uso ✅
> Momento mais crítico de retenção: usuário cria conta e chega num dashboard vazio. O que acontece agora determina se ele volta amanhã.

- [x] Empty state do dashboard com dois cards de entrada guiada: "Identificar por foto" e "Buscar pelo nome" — ambos linkam para `/add-plant` com contexto visual diferente
- [x] **Fluxo dedicado**: após registro, redirecionar para `/add-plant` diretamente em vez de `/dashboard` (evitar o empty state completamente no primeiro uso)
- [x] **Tooltip / coachmark**: na primeira visita ao dashboard *com plantas*, destacar o botão Bell de notificações com dica contextual (flag `pch_bell_hint_shown` em localStorage)
- [x] **Email de boas-vindas**: após registro, enviar email com 3 dicas de uso via Nodemailer
