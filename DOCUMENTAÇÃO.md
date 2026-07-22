# Documentação completa — Planejamento Financeiro

## 1. Finalidade deste documento

Este documento descreve o estado atual do aplicativo Planejamento Financeiro. Ele serve como referência funcional, técnica, operacional e de manutenção. O conteúdo foi elaborado a partir dos arquivos existentes no repositório e documenta o que está implementado atualmente.

O sistema é uma aplicação web responsiva de controle financeiro pessoal. Cada pessoa acessa sua própria conta, registra ganhos e despesas, acompanha resultados mensais, cria metas financeiras, registra depósitos nessas metas e exporta relatórios.

## 2. Visão geral da arquitetura

O aplicativo utiliza uma arquitetura cliente-servidor:

```text
Navegador do usuário
  ├─ HTML montado pelo servidor
  ├─ CSS modular
  ├─ JavaScript modular
  └─ Firebase Authentication Web
          │
          │ HTTPS + token Firebase no cabeçalho Authorization
          ▼
Servidor Node.js no Render
  ├─ Express
  ├─ Helmet
  ├─ Limitador de requisições
  ├─ Firebase Admin
  └─ API REST
          │
          ▼
PostgreSQL / Neon
  ├─ usuários
  ├─ configurações
  ├─ movimentações
  ├─ categorias personalizadas
  ├─ metas financeiras
  └─ depósitos das metas
```

### 2.1 Responsabilidade do navegador

O navegador exibe a interface, captura as ações do usuário, calcula valores para apresentação, gera gráficos com CSS ou Canvas, produz arquivos PDF/Excel e chama a API. O cliente não recebe a senha do banco nem as credenciais administrativas do Firebase.

### 2.2 Responsabilidade do servidor

O servidor monta o documento HTML, entrega os arquivos públicos, valida tokens Firebase, associa a identidade Firebase ao usuário interno, aplica o isolamento por usuário e executa consultas no PostgreSQL.

### 2.3 Responsabilidade do Firebase

O Firebase Authentication executa cadastro, login, login Google, confirmação de e-mail, redefinição de senha e emissão dos tokens de identidade usados pela API.

### 2.4 Responsabilidade do Neon

O Neon mantém os dados permanentes do aplicativo em PostgreSQL. A remoção do aplicativo do celular ou a limpeza do navegador não apaga os registros que já foram enviados ao servidor.

### 2.5 Aplicativo Android com Capacitor

O instalável oficial é um aplicativo Android criado com Capacitor. O HTML, CSS, JavaScript, Firebase Web, Lucide, jsPDF, AutoTable, ExcelJS, ícones e telas de abertura são copiados para dentro do APK. Por isso, a interface abre sem aguardar o Render.

Quando executado no Android, o arquivo `public/js/00-runtime.js` direciona as chamadas de API para `https://planejamento-financeiro-0b29.onrender.com`. O Neon continua sendo a fonte permanente dos dados e o Render continua validando a identidade e executando a API.

Cada usuário possui uma cópia local isolada de movimentações, configurações, categorias e metas. Se uma gravação falhar por ausência de rede, erro 5xx ou indisponibilidade temporária, a operação é colocada em uma fila durável. Ao recuperar a conexão, o aplicativo envia a fila na ordem original e depois atualiza a cópia local com o estado do servidor.

O PWA foi desativado. `08-platform.js` remove registros e caches antigos do Service Worker nos navegadores que instalaram versões anteriores.

## 3. Tecnologias e dependências

### 3.1 Servidor e infraestrutura

| Tecnologia | Uso atual |
|---|---|
| Node.js 22+ | Runtime do servidor. |
| Express 4 | Servidor HTTP, arquivos públicos e API REST. |
| PostgreSQL | Banco relacional. |
| Neon | Hospedagem PostgreSQL usada em produção. |
| Render | Hospedagem do processo Node.js. |
| Firebase Admin | Verificação segura dos tokens no servidor. |
| Helmet | Cabeçalhos de segurança e Content Security Policy. |
| express-rate-limit | Limitação das chamadas realizadas em `/api`. |
| pg | Driver PostgreSQL do Node.js. |

### 3.2 Navegador

| Biblioteca | Uso atual |
|---|---|
| Firebase Web Compat 12.16.0 | Autenticação no navegador, instalada pelo npm e servida pela própria aplicação. |
| Capacitor 8 | Contêiner nativo e projeto Android. |
| jsPDF 4.2.1 | Geração de PDF. |
| jsPDF AutoTable 5.0.8 | Tabelas no PDF. |
| ExcelJS 4.4.0 | Geração de arquivos XLSX. |
| Lucide | Ícones da interface. |

Todas as bibliotecas do navegador são instaladas pelo npm e servidas em `/vendor`. O build móvel copia exatamente esses arquivos para o APK, eliminando a dependência de CDNs para autenticação, ícones e relatórios.

## 4. Estrutura completa do repositório

```text
planejamento-financeiro/
├─ public/
│  ├─ css/
│  │  ├─ base.css
│  │  ├─ dashboard.css
│  │  ├─ goals.css
│  │  ├─ transactions.css
│  │  ├─ dialogs.css
│  │  ├─ responsive.css
│  │  └─ themes.css
│  └─ js/
│     ├─ 00-runtime.js
│     ├─ 01-foundation.js
│     ├─ 02-data.js
│     ├─ 03-dashboard.js
│     ├─ 04-ui.js
│     ├─ 05-reports.js
│     ├─ 06-goal-form.js
│     ├─ 07-events.js
│     └─ 08-platform.js
│  ├─ icons/
│  │  ├─ icon-192.png
│  │  ├─ icon-512.png
│  │  ├─ icon-maskable-512.png
│  │  ├─ apple-touch-icon.png
│  │  └─ favicon-64.png
├─ src/
│  ├─ server.mjs
│  └─ views/
│     ├─ layout.html
│     ├─ auth/index.html
│     ├─ screens/
│     │  ├─ navigation.html
│     │  ├─ dashboard.html
│     │  ├─ goals.html
│     │  ├─ transactions.html
│     │  ├─ insights.html
│     │  └─ records.html
│     ├─ modals/
│     │  ├─ goal.html
│     │  ├─ transaction.html
│     │  ├─ export.html
│     │  ├─ profile.html
│     │  └─ system-dialog.html
│     └─ partials/
│        ├─ topbar.html
│        └─ scripts.html
├─ android/                Projeto Android nativo
├─ capacitor.config.json  Configuração Capacitor
├─ scripts/
│  ├─ build-mobile.mjs
│  └─ migrate-users-to-firebase.mjs
├─ .env.example
├─ .gitignore
├─ package.json
├─ package-lock.json
├─ README.md
├─ render.yaml
└─ schema.sql
```

### 4.1 Pasta `public`

Somente arquivos que podem ser entregues diretamente ao navegador ficam nessa pasta. O Express usa `express.static()` apontando para ela. A resposta recebe `Cache-Control: no-store`, portanto o navegador é instruído a não manter uma versão permanente desses arquivos.

### 4.2 Pasta `src/views`

As telas não são páginas independentes com URLs próprias. Elas são partes de uma única aplicação. O servidor lê `layout.html`, substitui os marcadores como `{{dashboard}}` e `{{goals}}` e mantém o HTML final em memória durante a execução.

Essa abordagem evita repetir cabeçalho, scripts, autenticação e estrutura geral, mas permite editar cada funcionalidade em seu próprio arquivo.

### 4.3 Ordem dos módulos JavaScript

Os módulos são scripts clássicos e compartilham o mesmo ambiente global. A numeração define a ordem obrigatória:

1. `00-runtime.js`: identifica navegador ou Capacitor e escolhe a origem da API.
2. `01-foundation.js`: estado, seletores, utilitários e autenticação básica.
3. `02-data.js`: cache por usuário, fila offline, sincronização e comunicação com a API.
4. `03-dashboard.js`: cálculos e renderização das telas.
5. `04-ui.js`: navegação e abertura/fechamento de modais.
6. `05-reports.js`: PDF, Excel e gráficos dos relatórios.
7. `06-goal-form.js`: formulário de criação e edição de metas.
8. `07-events.js`: eventos, inicialização, reconexão e retomada online.
9. `08-platform.js`: remove instalações e caches legados do antigo PWA.

Alterar essa ordem pode fazer um módulo tentar usar variáveis ou funções que ainda não foram declaradas.

O estado inicial de `settings` é criado diretamente no primeiro módulo, usando os valores padrão e a cópia local disponível. Ele não pode chamar uma função declarada somente em um script posterior, pois scripts clássicos diferentes são executados sequencialmente e não compartilham içamento de declarações entre arquivos.

## 5. Montagem da interface HTML

Ao iniciar, `src/server.mjs` lê os arquivos de `src/views` com `readFileSync`. O objeto de composição associa cada marcador a um arquivo. O resultado é armazenado em `indexDocument`.

Qualquer rota GET que não seja atendida anteriormente cai em `app.get("*")` e recebe esse documento. Isso permite recarregar a aplicação sem expor os arquivos internos de `src/views`.

Os arquivos em `public` são entregues diretamente. Os arquivos em `src` não são publicados como estáticos.

## 6. Navegação e telas

O aplicativo usa abas controladas por `data-tab-target` e `data-tab-panel`. A função `setActiveTab()` ativa a aba escolhida e atualiza `aria-pressed`.

As cinco áreas principais são:

1. Início.
2. Registrar.
3. Metas.
4. Destino.
5. Registros.

### 6.0 Instalação do aplicativo

O aplicativo é instalado por um APK de desenvolvimento ou por um AAB assinado e publicado na Play Store. O navegador não oferece mais o botão de instalação PWA.

O cabeçalho do site apresenta o botão “Baixar para Android”. Ele chama `GET /download/android`; o Express entrega `downloads/planejamento-financeiro.apk` como `Planejamento-Financeiro.apk` com o tipo MIME de pacote Android. Dentro do aplicativo Capacitor, o botão é ocultado para evitar oferecer o próprio instalador novamente.

Fluxo de desenvolvimento Android:

1. execute `npm install`;
2. execute `npm run cap:sync` sempre que HTML, CSS, JavaScript ou bibliotecas forem alterados;
3. execute `npm run cap:open` para abrir no Android Studio;
4. use `android/gradlew.bat assembleDebug` para gerar o APK de teste;
5. o APK de desenvolvimento fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para distribuição pública é necessário criar uma chave de assinatura privada, configurar a assinatura de release e gerar um Android App Bundle. A chave de assinatura não deve ser versionada.

### 6.1 Tela Início

Arquivo: `src/views/screens/dashboard.html`.

Apresenta:

- seletor do mês analisado;
- total de ganhos;
- total de despesas;
- saldo do mês;
- lucro médio por dia;
- ganho médio por dia;
- meta diária de ganhos;
- valor ganho no dia atual;
- progresso percentual da meta diária;
- atalhos para registro, metas, análise, registros e relatórios.

#### Cálculos do resumo

- Ganhos: soma das movimentações `income` do mês escolhido.
- Despesas: soma das movimentações `expense` do mês escolhido.
- Saldo: ganhos menos despesas.
- Lucro por dia: saldo dividido pela quantidade de dias considerada.
- Ganhos por dia: ganhos divididos pela mesma quantidade de dias.

Para o mês atual, a contagem vai do primeiro dia até hoje. Para outro mês, utiliza todos os dias do mês. Domingos são excluídos por padrão e incluídos quando a preferência correspondente estiver ativada.

#### Meta diária

A meta diária fica em `settings.dailyGoal`. O progresso compara somente os ganhos registrados com a data de hoje. O percentual visual é limitado a 100%, mesmo que o valor recebido ultrapasse a meta.

### 6.2 Tela Registrar

Arquivo: `src/views/screens/transactions.html`.

Apresenta:

- cartões para registrar ganho ou despesa;
- totais de ganhos e despesas do mês;
- saldo mensal;
- quantidade de lançamentos;
- data da última movimentação;
- gráfico circular de ganhos versus despesas;
- três lançamentos recentes;
- orientação sobre movimentações mensais fixas.

Ao escolher ganho ou despesa, o sistema abre o modal de movimentação e configura título, botão, categorias e exemplos de acordo com o tipo.

### 6.3 Modal de movimentação

Arquivo: `src/views/modals/transaction.html`.

Campos:

| Campo | Regra |
|---|---|
| Tipo | Oculto; `income` ou `expense`. |
| Descrição | Obrigatória. |
| Valor | Obrigatório, mínimo `0.01`. |
| Data | Obrigatória; inicia com a data atual. |
| Categoria | Selecionada entre categorias padrão e personalizadas. |
| Frequência | `daily`, `monthly` ou `occasional`. |
| Observação | Opcional. |

O identificador é criado no navegador com `crypto.randomUUID()`. Após o envio, a movimentação é inserida na lista local, a tela é atualizada e a API recebe a operação.

O modal fecha pelo botão X, pelo fundo ou pela tecla Escape.

### 6.4 Categorias

Categorias padrão de ganho:

- Trabalho.
- Freelance.
- Venda.
- Extra.
- Outro ganho.

Categorias padrão de despesa:

- Aluguel.
- Luz.
- Água.
- Wifi.
- Comida.
- Mercado.
- Transporte.
- Saúde.
- Lazer.
- Outro gasto.

O gerenciador permite criar, renomear e excluir categorias personalizadas.

Regras:

- nome entre 2 e 40 caracteres;
- tipo restrito a ganho ou despesa;
- nomes personalizados não podem se repetir para o mesmo usuário e tipo, ignorando maiúsculas e minúsculas;
- ao renomear, todas as movimentações do usuário que usam o nome anterior são atualizadas na mesma transação de banco;
- uma categoria em uso não pode ser excluída.

### 6.5 Tela Metas

Arquivo: `src/views/screens/goals.html`.

Apresenta:

- saldo do mês;
- total reservado nas metas ativas;
- saldo livre estimado;
- gráfico de saldo livre versus reservado;
- progresso conjunto das metas ativas;
- cartões de metas abertas;
- histórico de metas concluídas.

#### Criação e edição

O botão Nova meta abre `src/views/modals/goal.html`. O formulário solicita nome, valor total e observação opcional. O mesmo modal é utilizado para edição.

#### Depósitos

Cada meta ativa aceita depósitos positivos. O depósito recebe UUID e data atual. O valor guardado é calculado pela soma dos depósitos no banco.

#### Conclusão

Quando o valor guardado alcança ou ultrapassa o valor planejado, o formulário de depósito é substituído pelo botão “Meta Concluída”. A API só permite concluir se:

- a meta pertence ao usuário autenticado;
- ainda não foi concluída;
- a soma dos depósitos é igual ou superior ao alvo.

Ao concluir, `completed_at` recebe a data e hora do servidor. A meta deixa a lista ativa e aparece no histórico com valor alcançado, objetivo e data de conclusão.

#### Exclusão

Excluir uma meta remove também todos os seus depósitos porque a relação usa `ON DELETE CASCADE`. Metas concluídas também podem ser removidas do histórico após confirmação.

#### Cálculos de reservas

Somente metas ainda não concluídas participam do total reservado e do progresso conjunto. O saldo livre estimado é o saldo do mês menos o valor reservado nas metas ativas.

### 6.6 Tela Destino

Arquivo: `src/views/screens/insights.html`.

Agrupa as despesas do mês por categoria e apresenta:

- gráfico circular;
- total gasto;
- categoria de maior valor;
- número de categorias utilizadas;
- valor e participação percentual de cada categoria.

As categorias são ordenadas do maior para o menor valor.

### 6.7 Tela Registros

Arquivo: `src/views/screens/records.html`.

Mostra as movimentações do mês em ordem decrescente de data. A tabela possui data, descrição, categoria, frequência, valor e ação de exclusão.

Filtros disponíveis:

- tudo, ganhos ou despesas;
- todas as frequências, diárias, mensais fixas ou eventuais.

Excluir exige confirmação. A API limita a exclusão ao proprietário do registro.

### 6.8 Perfil

Arquivo: `src/views/modals/profile.html`.

Exibe nome, e-mail e provedores associados. Permite:

- vincular uma conta Google;
- solicitar redefinição de senha por e-mail;
- escolher se domingos entram nas médias;
- sair da conta.

O modal preserva o elemento que estava em foco e devolve o foco ao fechar.

### 6.9 Tema claro e escuro

A preferência usa a chave `planejamento-financeiro-theme-v1` no `localStorage`. Sem preferência salva, o aplicativo consulta `prefers-color-scheme`. A raiz do documento recebe `data-theme="light"` ou `data-theme="dark"`.

## 7. Autenticação detalhada

### 7.1 Configuração no navegador

O navegador solicita `/api/config/firebase`. O servidor devolve apenas:

- `apiKey`;
- `authDomain`;
- `projectId`;
- `appId`.

Esses valores identificam o aplicativo Web Firebase. Credenciais administrativas não são devolvidas.

### 7.2 Login por e-mail e senha

O formulário usa `signInWithEmailAndPassword`. Depois do login, o cliente recarrega o usuário, verifica `emailVerified`, força a renovação do token e consulta `/api/auth/me`.

### 7.3 Cadastro

O cadastro exige nome, e-mail, senha e confirmação. A senha precisa ter:

- pelo menos 10 caracteres;
- uma letra minúscula;
- uma letra maiúscula;
- um número;
- um caractere especial;
- no máximo 128 caracteres pelo campo HTML.

Após criar a conta, o nome é gravado no perfil Firebase e o e-mail de confirmação é enviado. O acesso financeiro fica bloqueado até a confirmação.

### 7.4 Login Google

O sistema tenta autenticação por popup. A implementação também trata o retorno de redirecionamento usando `sessionStorage` para registrar a ação iniciada.

### 7.5 Confirmação de e-mail

Contas de e-mail e senha não confirmadas veem uma tela específica. É possível verificar novamente, reenviar o e-mail ou sair. O servidor também recusa tokens sem `email_verified`, portanto a proteção não depende apenas da interface.

### 7.6 Recuperação e alteração de senha

O Firebase envia o link de redefinição para o e-mail informado. No perfil, a mesma operação é oferecida para o usuário autenticado.

### 7.7 Associação Firebase → banco interno

O servidor verifica o token com Firebase Admin. Em seguida:

1. procura `users.firebase_uid`;
2. se não encontrar, procura o e-mail em minúsculas dentro de uma transação com bloqueio;
3. se o e-mail já existir, vincula o UID Firebase;
4. se não existir, cria um usuário;
5. confirma a transação;
6. retorna somente id, nome e e-mail.

Esse processo permite associar contas antigas ao novo sistema de autenticação.

### 7.8 Encerramento de sessão

Ao sair, o Firebase encerra a sessão e os arrays de movimentações, metas e categorias são limpos no navegador antes de exibir novamente a tela de acesso.

## 8. Estado e persistência no navegador

O estado principal usa arrays e objetos em memória:

- `transactions`;
- `settings`;
- `savingsGoals`;
- `customCategories`.

Chaves locais existentes:

| Chave | Conteúdo |
|---|---|
| `planejamento-financeiro-v1` | Movimentações locais. |
| `planejamento-financeiro-settings-v1` | Configurações locais. |
| `planejamento-financeiro-savings-goals-v1` | Metas locais. |
| `planejamento-financeiro-theme-v1` | Tema visual. |

Quando banco e Firebase estão configurados, `authRequired` fica verdadeiro e os dados financeiros são obtidos da API. Depois de cada leitura ou alteração, uma cópia é gravada com uma chave que inclui o UID Firebase. Esse isolamento impede que o cache de uma conta seja exibido por outra conta no mesmo aparelho.

Operações sem conexão atualizam a interface imediatamente e são gravadas em `planejamento-financeiro-sync-queue-v1:<uid>`. A fila armazena caminho, método, corpo e data. A sincronização respeita a ordem de criação, tolera reenvio idempotente e ocorre ao iniciar com rede ou quando o evento `online` é recebido.

### 8.1 Persistência e sincronização do Capacitor

O diretório `dist/` contém a interface móvel montada e todas as dependências de navegador. Ele é gerado por `scripts/build-mobile.mjs`, não é versionado e é copiado pelo Capacitor para `android/app/src/main/assets/public`.

No Android, a interface não depende de uma resposta do Render para abrir. Se houver sessão Firebase e cache local, o aplicativo mostra os últimos dados imediatamente. O Render e o Neon continuam necessários para autenticar uma nova instalação, renovar a comunicação e preservar ou compartilhar dados entre aparelhos.

Antes de baixar o estado remoto, `flushSyncQueue()` envia as alterações pendentes. Criações de movimentações, metas e depósitos usam identificadores UUID e endpoints idempotentes, evitando duplicidade caso o servidor tenha processado uma requisição cuja resposta não chegou ao celular.

## 9. API REST completa

Todas as rotas protegidas exigem `Authorization: Bearer <Firebase ID token>`.

### 9.1 Saúde e configuração

| Método | Rota | Protegida | Resultado |
|---|---|---:|---|
| GET | `/api/health` | Não | Informa conexão do banco e configuração Firebase. Se houver banco, executa `SELECT 1`. |
| GET | `/api/config/firebase` | Não | Retorna a configuração pública do Firebase Web ou 503. |

### 9.2 Identidade

| Método | Rota | Protegida | Resultado |
|---|---|---:|---|
| GET | `/api/auth/me` | Sim | Vincula/localiza o usuário interno e retorna id, nome e e-mail. |

### 9.3 Movimentações

| Método | Rota | Corpo | Resultado |
|---|---|---|---|
| GET | `/api/transactions` | — | Lista os registros do usuário por data e criação decrescentes. |
| POST | `/api/transactions` | `id`, `type`, `description`, `amount`, `date`, `category`, `frequency`, `note` | Cria e retorna uma movimentação; status 201. |
| DELETE | `/api/transactions/:id` | — | Exclui apenas se pertencer ao usuário; status 204. |

Não existe endpoint de edição de movimentação no estado atual.

### 9.4 Categorias personalizadas

| Método | Rota | Corpo | Resultado |
|---|---|---|---|
| GET | `/api/categories` | — | Lista id, tipo e nome. |
| POST | `/api/categories` | `id`, `type`, `name` | Cria categoria; 409 em duplicidade. |
| PUT | `/api/categories/:id` | `name` | Renomeia categoria e atualiza registros associados. |
| DELETE | `/api/categories/:id` | — | Exclui se não estiver em uso. |

### 9.5 Metas financeiras

| Método | Rota | Corpo | Resultado |
|---|---|---|---|
| GET | `/api/savings-goals` | — | Lista metas com soma e histórico dos depósitos. |
| POST | `/api/savings-goals` | `id`, `name`, `targetAmount`, `note` | Cria meta; status 201. |
| PUT | `/api/savings-goals/:id` | `name`, `targetAmount`, `note` | Edita a meta. |
| POST | `/api/savings-goals/:id/deposits` | `id`, `amount`, `date` | Adiciona depósito e devolve a meta recalculada. |
| POST | `/api/savings-goals/:id/complete` | — | Conclui se a soma atingir o alvo. |
| DELETE | `/api/savings-goals/:id` | — | Exclui meta e depósitos relacionados. |

### 9.6 Configurações

| Método | Rota | Corpo | Resultado |
|---|---|---|---|
| GET | `/api/settings` | — | Retorna as configurações como objeto chave/valor. |
| PUT | `/api/settings/:key` | `value` | Cria ou atualiza a chave do usuário. |

Chaves utilizadas atualmente:

- `dailyGoal`;
- `includeSundays`.

## 10. Códigos HTTP relevantes

| Código | Uso no aplicativo |
|---:|---|
| 200 | Consulta ou atualização bem-sucedida. |
| 201 | Recurso criado. |
| 204 | Exclusão bem-sucedida sem corpo. |
| 400 | Campos ausentes ou tentativa inválida de concluir meta. |
| 401 | Token ausente ou inválido. |
| 403 | E-mail ainda não confirmado. |
| 404 | Meta ou categoria não encontrada. |
| 409 | Categoria duplicada ou em uso. |
| 429 | Limite de requisições excedido. |
| 503 | Banco ou Firebase necessário não configurado. |

## 11. Banco de dados

O arquivo `schema.sql` é a referência legível. A função `migrate()` em `src/server.mjs` é executada ao iniciar e cria ou ajusta estruturas com comandos idempotentes.

### 11.1 Extensão

`pgcrypto` é habilitada para disponibilizar `gen_random_uuid()`.

### 11.2 Tabela `users`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | Chave primária; gerada pelo PostgreSQL. |
| `firebase_uid` | TEXT | Único quando preenchido. |
| `name` | TEXT | Obrigatório. |
| `email` | TEXT | Obrigatório e único. |
| `password_hash` | TEXT | Legado, atualmente pode ser nulo. |
| `created_at` | TIMESTAMPTZ | Data de criação. |

### 11.3 Tabela `settings`

| Coluna | Tipo | Regra |
|---|---|---|
| `user_id` | UUID | Referência a `users`; exclusão em cascata. |
| `key` | TEXT | Nome da configuração. |
| `value` | TEXT | Valor serializado como texto. |
| `updated_at` | TIMESTAMPTZ | Atualização automática na API. |

A combinação `(user_id, key)` é única.

### 11.4 Tabela `transactions`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | Chave primária criada pelo cliente. |
| `user_id` | UUID | Proprietário. |
| `type` | TEXT | Apenas `income` ou `expense`. |
| `description` | TEXT | Obrigatória. |
| `amount` | NUMERIC(12,2) | Maior que zero. |
| `date` | DATE | Data financeira. |
| `category` | TEXT | Nome da categoria. |
| `frequency` | TEXT | `daily`, `monthly` ou `occasional`. |
| `note` | TEXT | Vazio por padrão. |
| `created_at` | TIMESTAMPTZ | Ordem de criação. |

Existe índice por `user_id`.

### 11.5 Tabela `custom_categories`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | Chave primária. |
| `user_id` | UUID | Obrigatório; cascata ao excluir usuário. |
| `type` | TEXT | Ganho ou despesa. |
| `name` | TEXT | Entre 2 e 40 caracteres. |
| `created_at` | TIMESTAMPTZ | Data de criação. |

O índice único utiliza `LOWER(name)` por usuário e tipo.

### 11.6 Tabela `savings_goals`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | Chave primária. |
| `user_id` | UUID | Proprietário. |
| `name` | TEXT | Obrigatório. |
| `target_amount` | NUMERIC(12,2) | Maior que zero. |
| `note` | TEXT | Vazio por padrão. |
| `completed_at` | TIMESTAMPTZ | Nulo enquanto ativa. |
| `created_at` | TIMESTAMPTZ | Data de criação. |

### 11.7 Tabela `savings_deposits`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | Chave primária. |
| `goal_id` | UUID | Referência à meta com cascata. |
| `amount` | NUMERIC(12,2) | Maior que zero. |
| `date` | DATE | Data do depósito. |
| `created_at` | TIMESTAMPTZ | Ordem de criação. |

O valor guardado não é armazenado diretamente na meta. Ele é calculado com `SUM(savings_deposits.amount)`, evitando divergência entre total e histórico.

## 12. Migrações automáticas

Na inicialização, o servidor:

1. cria a extensão `pgcrypto`;
2. cria tabelas ausentes;
3. adiciona `firebase_uid` e permite `password_hash` nulo;
4. adiciona `user_id` às tabelas antigas quando necessário;
5. adiciona `completed_at` às metas antigas;
6. remove a antiga chave primária simples de `settings`, se existir;
7. cria índices de unicidade e consulta.

Se qualquer etapa falhar, o processo registra “Erro ao iniciar banco de dados” e encerra com código 1. O Render considera isso falha de inicialização.

## 13. Relatórios

O modal de exportação permite escolher o mês atual ou outro mês e o formato PDF ou XLSX.

### 13.1 Resumo utilizado

Para o mês escolhido são calculados:

- ganhos;
- despesas;
- saldo;
- despesas agrupadas por categoria;
- médias diárias;
- taxa de economia;
- taxa de despesa sobre ganhos;
- maior categoria;
- quantidade de movimentações;
- consolidação por dia.

### 13.2 PDF

O PDF é produzido no navegador com jsPDF e AutoTable, em orientação paisagem A4. A implementação cria gráficos em Canvas, insere resumo, indicadores, distribuição por categoria e movimentações. O arquivo segue o nome `planejamento-financeiro-AAAA-MM.pdf`.

### 13.3 Excel

O Excel é produzido com ExcelJS. A pasta de trabalho contém dados financeiros, fórmulas, estilos, filtros e configurações de impressão. O arquivo segue o nome `planejamento-financeiro-AAAA-MM.xlsx`.

### 13.4 Privacidade da exportação

A geração ocorre no navegador. O servidor não cria nem armazena os arquivos exportados.

## 14. Segurança

### 14.1 Isolamento por usuário

As consultas protegidas recebem `user.id` derivado do token verificado. Seleções, atualizações e exclusões incluem `user_id`, impedindo que um identificador de outro usuário seja suficiente para acessar seus dados.

### 14.2 Cabeçalhos Helmet

O servidor:

- remove a identificação Express com `x-powered-by` desativado;
- bloqueia exibição em frames;
- usa política de referência `no-referrer`;
- restringe scripts, conexões, imagens, fontes e frames com CSP;
- permite popups do Firebase com `same-origin-allow-popups`.

As chamadas da API aceitam as origens locais usadas pelo Capacitor (`https://localhost`, `http://localhost` e `capacitor://localhost`). O servidor responde às requisições `OPTIONS` e permite os cabeçalhos `Authorization` e `Content-Type` somente para essas origens conhecidas.

### 14.3 Content Security Policy

Scripts são aceitos somente da própria origem, jsDelivr e unpkg. Conexões são aceitas para a própria origem e endpoints Google/Firebase previstos. Objetos incorporados são bloqueados.

### 14.4 Limitação de requisições

Todas as rotas `/api` compartilham limite de 600 requisições por janela de 15 minutos. Os cabeçalhos seguem o padrão draft-7. Ao exceder, a resposta informa que é necessário aguardar.

### 14.5 Limite JSON

O corpo JSON é limitado a 100 KB.

### 14.6 SSL do PostgreSQL

Em produção, o pool utiliza SSL com `rejectUnauthorized: false`, compatível com a conexão hospedada utilizada pelo projeto. Fora de produção, SSL fica desativado.

### 14.7 Dados que nunca devem ir para o Git

- `DATABASE_URL` real;
- `FIREBASE_PRIVATE_KEY`;
- `FIREBASE_CLIENT_EMAIL` quando tratado como credencial administrativa operacional;
- qualquer arquivo `.env` real;
- tokens de usuários.

## 15. Variáveis de ambiente

| Variável | Obrigatória em produção | Descrição |
|---|---:|---|
| `NODE_ENV` | Sim | `production` no Render; ativa proxy confiável e SSL do banco. |
| `PORT` | Fornecida pelo Render | Porta HTTP; padrão local 5500. |
| `DATABASE_URL` | Sim | Conexão PostgreSQL/Neon. |
| `FIREBASE_PROJECT_ID` | Sim | Projeto Firebase. |
| `FIREBASE_API_KEY` | Sim | Chave pública do aplicativo Web Firebase. |
| `FIREBASE_AUTH_DOMAIN` | Sim | Domínio de autenticação Firebase. |
| `FIREBASE_APP_ID` | Sim | ID do aplicativo Web. |
| `FIREBASE_CLIENT_EMAIL` | Recomendável | Conta de serviço do Firebase Admin. |
| `FIREBASE_PRIVATE_KEY` | Recomendável | Chave privada da conta de serviço. |

Quando e-mail e chave privada não são fornecidos, o servidor tenta `applicationDefault()`. No Render, normalmente devem ser fornecidos explicitamente.

## 16. Execução local

### 16.1 Pré-requisitos

- Node.js 22 ou superior.
- npm.
- PostgreSQL acessível.
- Firebase configurado.

### 16.2 Instalação

```powershell
npm install
```

### 16.3 Ambiente

Crie `.env` a partir de `.env.example`. Observação: o código atual não carrega `.env` automaticamente com `dotenv`. As variáveis precisam estar disponíveis no ambiente do processo ou ser fornecidas pela ferramenta usada para executar o servidor.

Exemplo no PowerShell:

```powershell
$env:DATABASE_URL="postgres://usuario:senha@localhost:5432/planejamento_financeiro"
$env:FIREBASE_PROJECT_ID="meu-projeto"
$env:FIREBASE_API_KEY="chave-publica"
$env:FIREBASE_AUTH_DOMAIN="meu-projeto.firebaseapp.com"
$env:FIREBASE_APP_ID="app-id"
$env:FIREBASE_CLIENT_EMAIL="conta-de-servico@meu-projeto.iam.gserviceaccount.com"
$env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
npm start
```

### 16.4 Acesso

Abra `http://127.0.0.1:5500`. Não abra um arquivo HTML diretamente por `file://`; a inicialização detecta essa situação e exige o servidor.

### 16.5 Saúde

Consulte:

```text
GET http://127.0.0.1:5500/api/health
```

Resultados possíveis incluem banco conectado/não configurado e Firebase configurado/não configurado.

## 17. Firebase — configuração operacional

1. Crie um projeto no Firebase.
2. Ative Authentication.
3. Ative E-mail/Senha.
4. Ative Google e configure o e-mail de suporte.
5. Cadastre o domínio do Render em Authorized domains.
6. Crie um aplicativo Web.
7. copie `apiKey`, `authDomain`, `projectId` e `appId`.
8. Em contas de serviço, gere as credenciais administrativas.
9. Cadastre todas as variáveis no Render.

Sem o domínio autorizado, login Google pode falhar. Sem Firebase Admin, a interface pode carregar, mas a API protegida responde 503.

## 18. Neon — configuração operacional

1. Crie um projeto Neon.
2. obtenha a connection string PostgreSQL.
3. cadastre-a como `DATABASE_URL` no Render.
4. mantenha SSL habilitado em produção.
5. faça o primeiro deploy; `migrate()` criará e ajustará as estruturas.
6. confirme `/api/health` com `database: "connected"`.

O arquivo `schema.sql` pode ser usado para leitura ou preparação manual, mas a inicialização do servidor continua sendo a fonte operacional das migrações incrementais.

## 19. Render — implantação

O arquivo `render.yaml` declara:

- serviço do tipo `web`;
- ambiente Node;
- build `npm install`;
- início `npm start`;
- `NODE_ENV=production`;
- demais segredos com `sync: false`.

Fluxo de implantação:

1. um commit é enviado à branch monitorada;
2. o Render clona o repositório;
3. executa `npm install`;
4. executa `npm start`;
5. `src/server.mjs` monta as telas;
6. conecta ao Neon;
7. executa as migrações;
8. começa a escutar em `0.0.0.0:$PORT`.

Se o deploy falhar, verifique primeiro logs, variáveis, credenciais Firebase, conexão Neon e a versão do Node.

## 20. Script de migração Firebase

Comando de simulação:

```powershell
npm run migrate:firebase-users
```

Aplicação real:

```powershell
npm run migrate:firebase-users -- --apply
```

O utilitário foi criado para migrar usuários legados, evitar duplicidades, vincular o UID Firebase e remover o hash antigo depois da confirmação. A simulação deve sempre ser revisada antes de usar `--apply`.

## 21. Estilos

### 21.1 `base.css`

Variáveis globais, tipografia, cabeçalho, botões, autenticação e elementos básicos.

### 21.2 `dashboard.css`

Abas, resumo, métricas, meta diária e ações rápidas.

### 21.3 `goals.css`

Resumo de reservas, cartões de metas, depósitos, conclusão e histórico.

### 21.4 `transactions.css`

Área de registro, categorias, gráficos, registros recentes, análises e tabela.

### 21.5 `dialogs.css`

Modais, perfil, diálogo do sistema e exportação.

### 21.6 `responsive.css`

Adaptações para tablets e celulares, incluindo navegação, grades, tabelas e modais.

### 21.7 `themes.css`

Substituições de cores e superfícies para o tema escuro.

A ordem dos links em `layout.html` deve ser preservada porque folhas posteriores podem sobrescrever regras anteriores.

## 22. Acessibilidade implementada

O HTML utiliza:

- `aria-label` em regiões, gráficos e controles;
- `aria-modal` e `role="dialog"` nos modais;
- `aria-labelledby` para associar títulos;
- `aria-pressed` em abas e tema;
- `aria-live` em mensagens de senha e erro;
- `role="alert"` para erros de autenticação;
- foco automático em formulários abertos;
- fechamento por Escape;
- retorno de foco em partes dos modais;
- ícones decorativos marcados com `aria-hidden`.

Qualquer nova tela deve manter esses padrões.

## 23. Convenções e formatos

- Idioma da interface: português do Brasil.
- Moeda: BRL pelo `Intl.NumberFormat("pt-BR")`.
- Datas enviadas à API: `YYYY-MM-DD`.
- Mês selecionado: `YYYY-MM`.
- IDs: UUID.
- Tipos financeiros: `income` e `expense`.
- Frequências: `daily`, `monthly`, `occasional`.
- Tema: `light` ou `dark`.
- Metas ativas: `completedAt` nulo.
- Metas concluídas: `completedAt` preenchido.

## 24. Fluxo de inicialização do navegador

A função `start()`:

1. aplica o tema preferido;
2. seleciona o mês atual;
3. redefine o formulário de movimentação;
4. define o mês inicial do relatório;
5. rejeita execução por `file://`;
6. consulta `/api/health`;
7. exige banco conectado e Firebase configurado;
8. inicializa Firebase Web;
9. processa eventual retorno de login Google;
10. espera o primeiro estado de autenticação;
11. mostra login, confirmação ou aplicação;
12. carrega dados da API;
13. renderiza todas as áreas;
14. atualiza ícones Lucide.

## 25. Tratamento visual e diálogos

O aplicativo possui um diálogo próprio para avisos e confirmações. As funções centrais são:

- `showNotice()` para informação, alerta, sucesso ou erro;
- `askConfirmation()` para ações destrutivas;
- `showSystemDialog()` para configurar conteúdo e botões;
- `closeSystemDialog()` para resolver a Promise associada.

Exclusões importantes não usam `window.confirm`; usam esse componente consistente e acessível.

### 25.1 Feedback temporário

A função `showToast()` apresenta mensagens não bloqueantes após ações do usuário. Esses avisos aparecem no canto superior direito em telas maiores e acima da navegação inferior em celulares. Cada aviso:

- informa sucesso, erro, alerta ou informação;
- utiliza cor e ícone correspondentes ao tipo;
- possui `role="status"` ou `role="alert"`;
- pode ser fechado manualmente;
- desaparece automaticamente após alguns segundos;
- não impede o usuário de continuar navegando;
- limita a região a três avisos simultâneos.

Há feedback para criação e exclusão de registros, atualização da meta diária, criação/edição/exclusão/conclusão de metas, depósitos, categorias, relatórios, preferências, reenvio de confirmação e mudança de tema. Quando uma operação financeira não consegue chegar à API, o aviso utiliza o tom de erro e informa que não houve sincronização.

## 26. Manutenção por funcionalidade

### Alterar autenticação

- HTML: `src/views/auth/index.html`.
- estado e funções: `public/js/01-foundation.js`.
- eventos: `public/js/07-events.js`.
- validação do token: `src/server.mjs`.

### Alterar painel e cálculos

- HTML: `src/views/screens/dashboard.html`.
- lógica: `public/js/03-dashboard.js`.
- CSS: `public/css/dashboard.css`.

### Alterar movimentações

- tela: `src/views/screens/transactions.html`.
- modal: `src/views/modals/transaction.html`.
- persistência: `public/js/02-data.js`.
- eventos: `public/js/07-events.js`.
- rotas: `src/server.mjs`.

### Alterar metas

- tela: `src/views/screens/goals.html`.
- modal: `src/views/modals/goal.html`.
- formulário: `public/js/06-goal-form.js`.
- persistência: `public/js/02-data.js`.
- renderização: `public/js/03-dashboard.js`.
- CSS: `public/css/goals.css`.

### Alterar relatórios

- modal: `src/views/modals/export.html`.
- geração: `public/js/05-reports.js`.

### Alterar perfil

- HTML: `src/views/modals/profile.html`.
- eventos: `public/js/07-events.js`.
- CSS: `public/css/dialogs.css`.

## 27. Procedimento seguro para mudanças

1. verifique `git status`;
2. identifique os arquivos da funcionalidade;
3. preserve IDs utilizados pelo JavaScript;
4. mantenha a ordem dos scripts e estilos;
5. valide JavaScript e servidor com `node --check`;
6. inicie localmente;
7. consulte `/api/health`;
8. carregue a página e confirme os arquivos estáticos;
9. teste autenticação e a funcionalidade alterada;
10. revise `git diff --check`;
11. faça commit descritivo;
12. envie ao GitHub;
13. acompanhe o deploy no Render.

## 28. Diagnóstico de problemas

### Página abre, mas login não funciona

Verifique configuração pública Firebase, domínio autorizado, provedores habilitados e console do navegador.

### API responde 401

O token está ausente, expirado ou inválido. Saia e entre novamente e confira o projeto Firebase usado pelo cliente e pelo Admin.

### API responde 403

O e-mail não está confirmado.

### API responde 503

`DATABASE_URL`, Firebase Admin ou configuração Web Firebase não estão disponíveis.

### Render não inicia

Confirme `npm start`, Node 22+, variáveis, conexão Neon e formatação da chave privada com `\n`.

### Meta não pode ser concluída

A soma dos depósitos precisa alcançar o alvo e `completed_at` precisa estar nulo.

### Categoria não pode ser excluída

Existe uma movimentação utilizando o nome da categoria.

### PDF ou Excel não é gerado

Verifique se `npm install` foi executado e se os arquivos locais em `/vendor/jspdf`, `/vendor/jspdf-autotable` e `/vendor/exceljs` respondem normalmente.

## 29. Limitações atuais conhecidas

- Não existe edição de uma movimentação já criada.
- Não existe exclusão individual de depósitos.
- O servidor concentra API e migrações em um único arquivo.
- Os módulos do navegador ainda compartilham escopo global e dependem da ordem numérica.
- A automação atual cobre cache por usuário e fila offline; ainda faltam testes completos da API e da interface.
- O carregamento de `.env` não é automático pelo código atual.
- A resposta de arquivos públicos usa `no-store`, priorizando atualização imediata em vez de cache.
- O login Google nativo ainda exige incluir a configuração Android do projeto Firebase e registrar a impressão SHA-1 antes da publicação na Play Store.

## 30. Caminho recomendado para evolução

1. corrigir e padronizar integralmente a codificação UTF-8 dos textos antigos;
2. adicionar testes de API e cálculos financeiros;
3. separar rotas e serviços do servidor por domínio;
4. converter scripts compartilhados em módulos ES explícitos;
5. adicionar endpoint e interface de edição de movimentações;
6. migrar o cache local para uma base SQLite criptografada se o volume de dados crescer;
7. adicionar uma interface de acompanhamento das operações pendentes;
8. adicionar observabilidade e acompanhamento de erros;
9. documentar backup e restauração do Neon.

## 31. Checklist de produção

- [ ] Render conectado à branch correta.
- [ ] `NODE_ENV=production`.
- [ ] `DATABASE_URL` do Neon configurada.
- [ ] Firebase Web configurado.
- [ ] Firebase Admin configurado.
- [ ] domínio do Render autorizado no Firebase.
- [ ] E-mail/Senha habilitado.
- [ ] Google habilitado.
- [ ] `/api/health` retorna banco conectado.
- [ ] cadastro e confirmação testados.
- [ ] login Google testado.
- [ ] isolamento entre dois usuários testado.
- [ ] criação e exclusão de movimentação testadas.
- [ ] criação, depósito e conclusão de meta testados.
- [ ] PDF e Excel testados.
- [ ] `npm run cap:sync` concluído.
- [ ] `android/gradlew.bat assembleDebug` concluído.
- [ ] ícone e tela de abertura conferidos em aparelho real.
- [ ] primeira autenticação online testada no Android.
- [ ] leitura local e fila de alterações testadas sem internet.
- [ ] reconexão e sincronização conferidas no Neon.
- [ ] chave de assinatura de release guardada fora do Git.
- [ ] SHA-1 do aplicativo registrada no Firebase para login Google nativo.
- [ ] logs do Render sem erros de migração.
- [ ] segredos ausentes do Git.

## 32. Melhorias da versão 1.1.0

- O cabeçalho mostra estado sincronizado, offline, quantidade pendente e erro que exige atenção.
- Tocar no indicador tenta reenviar a fila e apresenta o motivo de uma falha persistente.
- Operações rejeitadas não são mais descartadas silenciosamente; tentativa, horário, status e mensagem ficam preservados.
- O perfil oferece política de privacidade e exclusão definitiva da conta.
- `DELETE /api/account` apaga o usuário no PostgreSQL; as chaves estrangeiras removem configurações, registros, categorias, metas e depósitos, e o Firebase Admin remove a identidade.
- Toda resposta da API recebe `X-Request-ID`; método, rota, status e duração são registrados no Render sem conteúdo financeiro ou token.
- O Android passou para versão 1.1.0, código 2, ofuscação e redução de recursos em release.
- `npm run android:release` exige assinatura externa, testa, gera APK/AAB e registra versão, tamanho e SHA-256.
- Chaves JKS, credenciais de release e `google-services.json` estão explicitamente fora do Git.
- O Android usa `FLAG_SECURE` para impedir capturas de tela e prévias do conteúdo financeiro na tela de aplicativos recentes; o backup do aplicativo permanece desativado.
- `npm test` cobre cache por usuário, reenvio, retenção de erro permanente, contrato de exclusão, privacidade, segurança Android e sintaxe.

A assinatura definitiva, o `google-services.json`, o SHA-1/SHA-256 no Firebase, o teste em aparelho físico e eventual mudança do plano do Render dependem das contas e credenciais do proprietário. O projeto bloqueia release sem essas credenciais. O procedimento completo está em `RELEASE_ANDROID.md`.

## 33. PWA para iPhone e convivência com Capacitor

A versão 1.2.0 mantém duas distribuições. No Android, o Capacitor empacota todos os recursos no APK e não registra service worker. No iPhone, o Safari registra `service-worker.js`, lê `manifest.webmanifest` e permite adicionar o aplicativo à Tela de Início.

O manifesto define nome, orientação, cores e ícones comuns e maskable. O HTML também declara `apple-touch-icon`, título e estilo da barra do iOS. O service worker preserva HTML, CSS, JavaScript, ícones e bibliotecas locais; requisições `/api/` e downloads nunca são armazenados em cache. Assim, autenticação e dados continuam vindo do Firebase, Render e Neon, enquanto a interface consegue abrir sem rede após a primeira visita.

O botão superior detecta o ambiente. No Android/navegador, oferece o APK. No iPhone, exibe “Instalar no iPhone” e orienta Compartilhar → Adicionar à Tela de Início. Dentro do APK ou do PWA já instalado, o botão fica oculto.

## 34. Atualizações do aplicativo Android

A versão 1.3.0 introduz verificação automática de atualização. O APK contém `APP_VERSION`, enquanto `GET /api/app-version` informa a versão publicada pelo `package.json` e o endereço oficial do APK. O aplicativo compara versões semânticas ao concluir a abertura e ao voltar do segundo plano.

Quando o servidor anuncia uma versão superior, um diálogo apresenta a versão instalada e a nova, com “Atualizar agora” e “Cancelar”. Confirmar abre o APK oficial no navegador do sistema. Adiar silencia somente aquela versão por seis horas. Falhas de rede são tentadas novamente depois de trinta segundos, e consultas normais são limitadas a uma a cada cinco minutos.

Toda alteração que precise chegar ao Android deve atualizar conjuntamente: `package.json`, `package-lock.json`, `APP_VERSION` em `00-runtime.js`, `versionName` e `versionCode` no Gradle, versão do cache PWA, documentação e APK em `downloads/`. Os testes conferem que `package.json`, JavaScript e Gradle possuem a mesma versão.

Um deploy apenas do servidor pode corrigir API e site sem exigir APK. Mudanças de interface ou lógica empacotada exigem nova versão e recompilação do APK; caso contrário, o servidor não deve anunciar uma versão que ainda não esteja disponível para download.

## 35. Exclusão segura da conta

Na versão 1.4.0, a ação destrutiva deixou de aparecer diretamente entre as ações principais do perfil. Ela fica recolhida em “Privacidade e dados”. Ao abrir a seção, o usuário recebe a explicação de irreversibilidade e precisa digitar exatamente o e-mail cadastrado; somente então o botão de exclusão é habilitado. Uma confirmação final ainda é exibida.

A validação não depende apenas da interface: `DELETE /api/account` exige `emailConfirmation` e compara o valor normalizado ao e-mail da identidade autenticada antes de apagar qualquer dado. Isso reduz exclusões acidentais e impede chamadas incompletas, preservando simultaneamente o caminho de exclusão exigido pelas lojas.

## 36. Ordenação cronológica dos registros

Na versão 1.5.0, cada movimentação preserva `createdAt` desde o momento em que é registrada no aparelho, inclusive offline. A API grava esse instante em `transactions.created_at` e o devolve ao cliente. A tela ordena primeiro pela data financeira em ordem decrescente e, quando dois registros possuem a mesma data, pelo horário de criação também decrescente. Dessa forma, o último registro criado no mesmo dia aparece primeiro de modo consistente antes e depois da sincronização.

Registros antigos recebem o `created_at` já existente no PostgreSQL ao serem carregados. O endpoint continua usando `ORDER BY date DESC, created_at DESC`, e a mesma regra é aplicada à tabela completa e ao resumo dos três registros recentes.

## 37. Resumo final

O Planejamento Financeiro é uma aplicação web autenticada, organizada por telas no servidor e por responsabilidades no navegador. O Firebase identifica as pessoas, o servidor Express valida cada requisição e o Neon preserva os dados financeiros. O projeto suporta controle mensal, médias, meta diária, categorias, metas com depósitos, histórico de conclusão, análises e relatórios.

Este arquivo deve ser atualizado sempre que uma funcionalidade, rota, tabela, variável de ambiente ou procedimento de implantação for alterado.
