# WhatsApp Validador ✅

**Descrição**

Projeto simples para verificar se um número é um contato válido no WhatsApp usando `whatsapp-web.js`. Expõe uma API HTTP (Express) com endpoints para checar números via GET e POST e exibe QR code para autenticação.

---

## 🔧 Pré-requisitos

- Node.js (recomenda-se v14+)
- NPM ou Yarn

---

## 🛠️ Instalação

1. Clone o repositório

```bash
git clone <repo-url>
cd WhatsappValidador
```

2. Instale dependências

```bash
npm install
```

---

## ▶️ Execução

Inicie a aplicação:

```bash
node CheckNumber.js
```

A aplicação roda por padrão em `http://localhost:3000`.

Ao iniciar, será exibido um QR code no console. Escaneie o QR com o WhatsApp para autenticar a sessão.

---

## 📚 Endpoints

- `GET /` - informações do serviço
- `GET /status` - status da conexão com o WhatsApp
- `POST /check-contact` - verifica número via JSON (ex.: `{ "numero": "912345678", "ddd": "62", "ddi": "55" }`)
- `GET /check-contact?phone=NUMERO` - verifica número via query string

---

## 🔎 Exemplos

GET:

```bash
curl "http://localhost:3000/check-contact?phone=6282391269"
```

POST:

```bash
curl -X POST http://localhost:3000/check-contact \
  -H "Content-Type: application/json" \
  -d '{"numero": "912345678", "ddd": "62", "ddi": "55"}'
```

---

## ⚠️ Observações

- Use com responsabilidade: o uso da API depende de uma sessão válida do WhatsApp e do QR code para autenticação.
- Pode ser necessário ajustar permissões e configurações do Puppeteer em ambientes sem interface gráfica.

---

## 📄 Licença

MIT

---

Se quiser que eu adicione instruções de persistência de sessão, variáveis de ambiente ou scripts NPM, posso atualizar o `README` rapidamente.