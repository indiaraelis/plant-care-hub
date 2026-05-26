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

---

## Fase 8 — Alertas de rega (core do app)
> Entrega o valor que o app já promete. Zero dependência externa.

- [ ] Calcular `nextWateringDate = lastWatered + wateringFrequencyDays` no frontend
- [ ] Badge colorido em cada card: atrasada / hoje / em dia
- [ ] Banner no topo do dashboard listando as urgentes do dia
- [ ] Mesma lógica para adubação (`lastFertilized + fertilizingFrequencyDays`)

## Fase 9 — Botão "Reguei agora" + histórico
> Interação central do app. Requer mudança no Model e nova rota.

- [ ] Adicionar `wateringHistory: [Date]` e `fertilizingHistory: [Date]` no `Plant.js`
- [ ] Nova rota `PATCH /api/plants/:id/water` (e `/fertilize`) — atualiza `lastWatered` e faz push no array
- [ ] Botão "Reguei" diretamente no card (sem abrir edição), com feedback toast
- [ ] Botão "Adubei" com a mesma lógica

## Fase 10 — Dashboard em grid + filtros
> UX que escala com muitas plantas. Depende dos badges da Fase 8.

- [ ] Refatorar layout do dashboard: lista → grid de cards (2 colunas mobile, 3 desktop)
- [ ] Campo `location` no model (ex: sala, varanda, quarto) — opcional
- [ ] Barra de busca por nome no dashboard
- [ ] Filtros rápidos: "Todas" / "Atrasadas" / "Hoje" / por cômodo
- [ ] Mensagem com personalidade no dashboard vazio

## Fase 11 — Autenticação robusta + conta
> Features de confiança. Requer Nodemailer.

- [ ] Aumentar JWT para 7 dias (ou implementar refresh token)
- [ ] `PATCH /api/auth/password` — alterar senha (verifica senha atual)
- [ ] `DELETE /api/auth/account` — deletar conta + todas as plantas
- [ ] Recuperação de senha via email (Nodemailer + token temporário com expiração)
- [ ] Corrigir `Register.js`: chamar `login()` direto após registro (sem redirecionar para `/login`)

## Fase 12 — Identificação por imagem (Gemini)
> Wow factor. Chave da API fica 100% no backend.

- [ ] Rota `POST /api/identify` — recebe imagem em base64, chama Gemini 1.5 Flash, retorna JSON estruturado
- [ ] Botão "Identificar por foto" no `AddPlant.js` — upload ou câmera
- [ ] Pré-preenchimento automático do formulário com o retorno do Gemini
- [ ] Tratar erros e respostas incertas do modelo (fallback manual)

## Fase 13 — PWA + notificações push
> Transforma em app nativo no celular. Depende das datas calculadas na Fase 8.

- [ ] Configurar `manifest.json` + ícones para instalação como PWA
- [ ] Service Worker básico (cache offline das páginas principais)
- [ ] Notificações locais agendadas via Notification API — dispara no dia da rega
- [ ] Tela de configuração: ativar/desativar notificações por planta

## Fase 14 — Histórico visual + estatísticas
> Satisfação e retenção. Depende do histórico da Fase 9.

- [ ] Calendário heatmap na página de detalhes da planta (estilo GitHub contributions) com `wateringHistory`
- [ ] Tela "Meu Jardim": total de plantas, regas esse mês, planta mais antiga, sequência atual (streak)
- [ ] Ampliar base local: +50 plantas domésticas comuns (Monstera, Pothos, Orquídea, Samambaia, Cacto, etc.)

## Fase 15 — Features especiais
> Diferenciação. Implementar após o core estar sólido.

- [ ] **Modo viagem**: usuário informa datas de ausência → app calcula quais plantas precisam de rega e gera lista copiável
- [ ] **Voz e personalidade**: revisar todas as mensagens do app (dashboard vazio, toasts, erros) com texto com charme
- [ ] Foto da planta (upload de imagem do usuário — Cloudinary free tier ou S3)
