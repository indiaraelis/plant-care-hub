# 🌿 Plant-Care Hub: Seu Gerenciador de Plantas Inteligente



Um aplicativo web full-stack desenvolvido para ajudar entusiastas de plantas a gerenciar seus cuidados, com lembretes de rega e adubação, e organização personalizada.

---

## ✨ Funcionalidades

* **Autenticação de Usuário:** Registro e Login seguros com JWT (JSON Web Tokens).
* **Gerenciamento de Plantas (CRUD):** Adicione, visualize, edite e exclua suas plantas personalizadas.
* **Busca de Plantas Externas (Trefle.io):** Pesquise um vasto banco de dados de espécies de plantas para preencher automaticamente os detalhes ao adicionar uma nova planta. (Nota: A funcionalidade de busca utiliza a filtragem por nome comum/científico, pois o endpoint de busca geral da API do Trefle.io pode apresentar instabilidades.)
* **Lembretes de Cuidado:** Veja rapidamente quais plantas precisam de atenção com base nas suas últimas ações e frequência definida.
* **Interface Intuitiva:** Um design limpo e responsivo para facilitar a navegação e o gerenciamento.
* **Proteção de Rotas:** Acesso aos dados das plantas restrito a usuários autenticados.

---

## 🚀 Tecnologias Utilizadas

Este projeto foi construído utilizando uma stack moderna e robusta:

### Backend (API RESTful)

* **Node.js:** Ambiente de execução JavaScript.
* **Express.js:** Framework web para Node.js, para construção da API.
* **MongoDB:** Banco de dados NoSQL flexível e escalável (hospedado no MongoDB Atlas).
* **Mongoose:** ODM (Object Data Modeling) para Node.js e MongoDB.
* **Axios:** Cliente HTTP para fazer requisições à API do Trefle.io. **Observação sobre a Trefle.io API:** Durante o desenvolvimento, foi identificado que o endpoint /api/v1/plants/search da Trefle.io pode retornar erros 500 Internal Server Error ou Invalid access token mesmo com requisições válidas. A funcionalidade de busca foi implementada utilizando o endpoint /api/v1/plants com o filtro filter[common_name] ou filter[scientific_name] para maior estabilidade.
* **bcryptjs:** Para hashing seguro de senhas.
* **jsonwebtoken (JWT):** Para autenticação baseada em tokens.
* **dotenv:** Para gerenciamento de variáveis de ambiente.
* **cors:** Para permitir requisições cross-origin entre frontend e backend.

### Frontend (Aplicação SPA)

* **React.js:** Biblioteca JavaScript para construção de interfaces de usuário.
* **React Router DOM:** Para gerenciamento de rotas na aplicação single-page.
* **Axios:** Cliente HTTP baseado em Promises para fazer requisições à API.
* **react-toastify:** Para notificações estilizadas e feedback ao usuário.
* **HTML5 & CSS3:** Para estrutura e estilização da interface.

---

## 🛠️ Como Rodar o Projeto Localmente

Siga estes passos para configurar e executar o Plant-Care Hub na sua máquina.

### Pré-requisitos

Certifique-se de ter o [Node.js](https://nodejs.org/) (com NPM) instalado.
Você precisará de um banco de dados MongoDB (recomenda-se [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) para o cluster gratuito).  

### 1. Clonar o Repositório

```bash
git clone <https://github.com/indiaraelis/plant-care-hub>
cd plant-care-hub
```
### 2. Configurar o Backend

Navegue até a pasta backend e instale as dependências:

```bash
cd backend
npm install
```

Crie um arquivo .env na raiz da pasta backend e adicione suas variáveis de ambiente. Você pode usar o .env.example como modelo:  

# backend/.env
PORT=5000
MONGODB_URI=SUA_STRING_DE_CONEXAO_DO_MONGODB_ATLAS
JWT_SECRET=UM_SEGREDO_BEM_FORTE_E_ALEATORIO
Substitua SUA_STRING_DE_CONEXAO_DO_MONGODB_ATLAS pela sua URL de conexão do 
MongoDB Atlas.  
Substitua UM_SEGREDO_BEM_FORTE_E_ALEATORIO por uma string segura e única.
TREFLE_API_KEY=SUA_CHAVE_DE_API_DO_TREFLE

# Inicie o servidor backend:

```bash
npm start
```
O servidor estará rodando em http://localhost:5000.

### 3. Configurar o Frontend
Abra um novo terminal e navegue de volta para a pasta raiz do projeto e, em seguida, para a pasta frontend:  

```bash
cd .. # Volta para a pasta plant-care-hub
cd frontend
npm install
```
Inicie o aplicativo frontend:

```bash
npm start
O aplicativo será aberto em seu navegador em http://localhost:3000.
```

## 💻 Uso da Aplicação
**Registro:** Acesse http://localhost:3000/register para criar uma nova conta.
**Login:** Faça login com suas credenciais em http://localhost:3000/login.
Dashboard: Após o login, você será redirecionado para o dashboard (/dashboard), onde poderá ver, adicionar, editar e excluir suas plantas.  

## 💡 Próximos Passos e Melhorias Futuras
**Lembretes por Notificação:** Implementar envio de notificações (e-mail, push) para lembrar o usuário de regar/adubar.
Pesquisa e Filtros: Adicionar funcionalidades de busca e filtragem de plantas no dashboard.  

**Detalhes da Planta:** Criar uma página dedicada para detalhes de cada planta.
Upload de Imagens: Permitir que os usuários adicionem fotos de suas plantas.
Internacionalização: Suporte a múltiplos idiomas.  

**Testes:** Escrever testes unitários e de integração para backend e frontend.
Dockerização: Empacotar a aplicação em contêineres Docker para facilitar a implantação.  

## 👨‍💻 Contribuição
Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença
Este projeto está licenciado sob a Licença MIT.
