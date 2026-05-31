# Contact Workspace for LibreChat

I built this as part of a fullstack assignment. The goal was to add a contacts feature to LibreChat so the AI can actually answer questions about people you know — not just give generic responses.

The short version: you import your contacts, and then you can ask the chat things like "who works at Acme Corp?" and it'll tell you based on your actual data, not make something up.

---

## What I built

- A contacts panel in the sidebar where you can add, edit, delete, and search contacts
- CSV import that handles bulk uploads (tested with 1k and 10k contacts)
- Chat integration that detects contact-related questions and automatically pulls in relevant contacts before sending to the AI
- A Contact Assistant agent with a lookup tool so you can ask it direct questions about your contacts
- A REST API for contacts with full CRUD + search + stats endpoints

---

## Getting it running

You'll need Node.js 18+, MongoDB, and a Google AI Studio key (free at aistudio.google.com).

**1. Install**

```bash
git clone https://github.com/your-username/LibreChat.git
cd LibreChat
npm install
```

**2. Environment setup**

```bash
cp .env.example .env
```

The important ones to set in `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat
GOOGLE_KEY=your_key_here

# Generate these at librechat.ai/toolkit/creds_generator
JWT_SECRET=
JWT_REFRESH_SECRET=
CREDS_KEY=
CREDS_IV=

# Any random string — used for the agent action auth
CONTACTS_INTERNAL_KEY=contacts-secret-key-2024-xK9mP3
```

**3. Config file**

```bash
cp librechat.example.yaml librechat.yaml
```

Add localhost to the allowed domains in `librechat.yaml` (needed for the agent action):

```yaml
actions:
  allowedDomains:
    - swapi.dev
    - librechat.ai
    - google.com
    - localhost
    - localhost:3080
```

**4. Build and run**

```bash
cd client && npm run build && cd ..
npm run backend:dev
```

Open `http://localhost:3080` and you're good.

---

## How the contacts feature works

### The sidebar panel

There's a people icon in the left nav that opens the Contacts panel. From there you can:
- View and search your contacts
- Add new ones manually (name, company, role, email, notes, plus any custom fields you want)
- Edit or delete existing ones
- Import from CSV

### CSV import

Click Import CSV and pick your file. I wrote the parser to handle messy real-world CSVs — it maps `first_name` + `last_name` into a single name field, handles `company_name` vs `company`, `designation` vs `role`, and puts everything else (city, mobile, pan, whatever) into a flexible attributes array so it's still searchable.

### Chat integration

This is the main thing. When you type a message in chat, the frontend checks if it looks like a contact question — things with "who", "company", "CTO", "works at", etc. If it does, it quietly fetches matching contacts from the database and adds them as context before sending to the AI.

So instead of the AI saying "I don't know who works at Acme Corp", it gets the actual contact data and can say "John Doe works there as CTO, his email is john@acme.com".

### The Contact Assistant agent

There's also a dedicated agent set up with a `contactLookupTool` action. You can ask it:

- *"Who works at [company]?"* — searches by company
- *"List all CTOs"* — searches by role
- *"Find contacts named Rahul"* — searches by name
- *"What companies are in my contacts?"* — returns stats
- *"Find contacts from Delhi"* — full text search

---

## Code structure

```
api/server/routes/
  contacts.js           — the main CRUD routes
  contacts.import.js    — handles CSV uploads
  contacts.tool.js      — the lookup API used by chat + the agent

client/src/
  components/Contacts/
    ContactsPanel.tsx   — the sidebar panel
    ContactCard.tsx     — each contact row
    ContactForm.tsx     — create/edit form
    ContactImport.tsx   — the import button
    SearchBar.tsx       — search input
  hooks/Nav/
    useUnifiedSidebarLinks.ts  — adds the contacts icon to the sidebar
  components/Chat/Input/
    ChatForm.tsx        — modified to inject contact context

packages/
  data-schemas/src/schema/contact.ts   — mongoose schema
  api/src/contacts/contactService.ts   — business logic
```

The contact schema uses a compound MongoDB text index across name, company, role, email, notes, and attribute values. The weights are set so name matches rank higher than company, which ranks higher than role, etc.

Auth on the contacts routes uses direct `jwt.verify()` against the refresh token cookie since that's how LibreChat stores the session. The agent tool routes also accept an internal API key so the agent action can authenticate without a browser session.

---

## Design questions

### If the system needed to support 1,000,000 contacts, how would you redesign it?

Honestly the current setup would start struggling around 50-100k contacts per user, mainly because of MongoDB's text search limitations.

The two biggest changes I'd make:

Replace MongoDB text search with something like Elasticsearch or Meilisearch. They're built specifically for this — you can get sub-10ms search on millions of documents. MongoDB text search is fine for moderate scale but it's not what you reach for at 1M records.

Move CSV import to a background queue. Right now it's synchronous, which works fine for 1k rows but a 1M row file would just time out. I'd use BullMQ with Redis, return a job ID immediately, and let the user poll for progress. The batched insertMany approach I'm already using (500 rows at a time) would stay the same, just moved to a worker.

Other things: sharding contacts by userId so each user's data is on the same shard, Redis caching for frequently searched contacts, cursor-based pagination instead of skip/limit (skip gets slow at high offsets).

### How would you ensure the assistant retrieves the most relevant contacts for a query?

Right now it's keyword matching via MongoDB text search — works well for straightforward queries but misses semantic ones. If someone asks "people interested in machine learning" and a contact has notes saying "loves AI and neural networks", the current search won't find them.

The proper fix is vector search. Generate embeddings for each contact's combined text, store them alongside the contact, and at query time embed the user's question and do a cosine similarity search. You'd combine this with the existing keyword search (hybrid search with reciprocal rank fusion) so you get the best of both.

I'd also add a query understanding step where the LLM parses the user's question before searching — extracting things like `{ company: "Acme", role: "CTO", city: "Mumbai" }` — so you can do precise field-level filtering instead of just throwing everything at a text index.

### What are the limitations of your current implementation?

A few honest ones:

The search is keyword-only so semantic queries don't work. "People who work in fintech" won't match a contact at a financial technology company unless those words literally appear somewhere in their data.

CSV import will time out on very large files. The 1M row dataset would need background job processing.

No deduplication. If you import the same CSV twice, you get duplicate contacts. There's no logic to detect "this looks like the same person" based on email or name + company.

The contacts routes use custom JWT verification instead of LibreChat's passport middleware. It works, but it means the routes bypass some of LibreChat's built-in middleware like tenant isolation, which matters in a multi-tenant deployment.

The contacts list panel doesn't use virtualized rendering. With 10k+ contacts loaded, the DOM gets heavy. react-window would fix this.

---

## Video and commit

Video recording: [add link here]

Commit ID: [run `git log --oneline -1` and paste here]

---

Built on LibreChat v0.8.6-rc1


<p align="center">
  <a href="https://librechat.ai">
    <img src="client/public/assets/logo.svg" height="256">
  </a>
  <h1 align="center">
    <a href="https://librechat.ai">LibreChat</a>
  </h1>
</p>

<p align="center">
  <strong>English</strong> ·
  <a href="README.zh.md">中文</a>
</p>

<p align="center">
  <a href="https://discord.librechat.ai"> 
    <img
      src="https://img.shields.io/discord/1086345563026489514?label=&logo=discord&style=for-the-badge&logoWidth=20&logoColor=white&labelColor=000000&color=blueviolet">
  </a>
  <a href="https://www.youtube.com/@LibreChat"> 
    <img
      src="https://img.shields.io/badge/YOUTUBE-red.svg?style=for-the-badge&logo=youtube&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
  <a href="https://docs.librechat.ai"> 
    <img
      src="https://img.shields.io/badge/DOCS-blue.svg?style=for-the-badge&logo=read-the-docs&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
  <a aria-label="Sponsors" href="https://github.com/sponsors/danny-avila">
    <img
      src="https://img.shields.io/badge/SPONSORS-brightgreen.svg?style=for-the-badge&logo=github-sponsors&logoColor=white&labelColor=000000&logoWidth=20">
  </a>
</p>

<p align="center">
<a href="https://railway.com/deploy/librechat-official?referralCode=HI9hWz&utm_medium=integration&utm_source=readme&utm_campaign=librechat">
  <img src="https://railway.com/button.svg" alt="Deploy on Railway" height="30">
</a>
<a href="https://zeabur.com/templates/0X2ZY8">
  <img src="https://zeabur.com/button.svg" alt="Deploy on Zeabur" height="30"/>
</a>
<a href="https://template.cloud.sealos.io/deploy?templateName=librechat">
  <img src="https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg" alt="Deploy on Sealos" height="30">
</a>
</p>

<p align="center">
  <a href="https://www.librechat.ai/docs/translation">
    <img 
      src="https://img.shields.io/badge/dynamic/json.svg?style=for-the-badge&color=2096F3&label=locize&query=%24.translatedPercentage&url=https://api.locize.app/badgedata/4cb2598b-ed4d-469c-9b04-2ed531a8cb45&suffix=%+translated" 
      alt="Translation Progress">
  </a>
</p>


# ✨ Features

- 🖥️ **UI & Experience** inspired by ChatGPT with enhanced design and features

- 🤖 **AI Model Selection**:  
  - Anthropic (Claude), AWS Bedrock, OpenAI, Azure OpenAI, Google, Vertex AI, OpenAI Responses API (incl. Azure)
  - [Custom Endpoints](https://www.librechat.ai/docs/quick_start/custom_endpoints): Use any OpenAI-compatible API with LibreChat, no proxy required
  - Compatible with [Local & Remote AI Providers](https://www.librechat.ai/docs/configuration/librechat_yaml/ai_endpoints):
    - Ollama, groq, Cohere, Mistral AI, Apple MLX, koboldcpp, together.ai,
    - OpenRouter, Helicone, Perplexity, ShuttleAI, Deepseek, Qwen, and more

- 🔧 **[Code Interpreter API](https://www.librechat.ai/docs/features/code_interpreter)**: 
  - Secure, Sandboxed Execution in Python, Node.js (JS/TS), Go, C/C++, Java, PHP, Rust, and Fortran
  - Seamless File Handling: Upload, process, and download files directly
  - No Privacy Concerns: Fully isolated and secure execution

- 🔦 **Agents & Tools Integration**:  
  - **[LibreChat Agents](https://www.librechat.ai/docs/features/agents)**:
    - No-Code Custom Assistants: Build specialized, AI-driven helpers
    - Agent Marketplace: Discover and deploy community-built agents
    - Collaborative Sharing: Share agents with specific users and groups
    - Flexible & Extensible: Use MCP Servers, tools, file search, code execution, and more
    - [Skills](https://www.librechat.ai/docs/features/skills): Create reusable `SKILL.md` instruction bundles for manual, automatic, or always-on agent workflows
    - [Subagents](https://www.librechat.ai/docs/features/subagents): Delegate focused work to isolated child agent runs with their own context windows
    - Compatible with Custom Endpoints, OpenAI, Azure, Anthropic, AWS Bedrock, Google, Vertex AI, Responses API, and more
    - [Model Context Protocol (MCP) Support](https://modelcontextprotocol.io/clients#librechat) for Tools

- 🔍 **Web Search**:  
  - Search the internet and retrieve relevant information to enhance your AI context
  - Combines search providers, content scrapers, and result rerankers for optimal results
  - **Customizable Jina Reranking**: Configure custom Jina API URLs for reranking services
  - **[Learn More →](https://www.librechat.ai/docs/features/web_search)**

- 🪄 **Generative UI with Code Artifacts**:  
  - [Code Artifacts](https://youtu.be/GfTj7O4gmd0?si=WJbdnemZpJzBrJo3) allow creation of React, HTML, and Mermaid diagrams directly in chat

- 🎨 **Image Generation & Editing**
  - Text-to-image and image-to-image with [GPT-Image-1](https://www.librechat.ai/docs/features/image_gen#1--openai-image-tools-recommended)
  - Text-to-image with [DALL-E (3/2)](https://www.librechat.ai/docs/features/image_gen#2--dalle-legacy), [Stable Diffusion](https://www.librechat.ai/docs/features/image_gen#3--stable-diffusion-local), [Flux](https://www.librechat.ai/docs/features/image_gen#4--flux), or any [MCP server](https://www.librechat.ai/docs/features/image_gen#5--model-context-protocol-mcp)
  - Produce stunning visuals from prompts or refine existing images with a single instruction

- 💾 **Presets & Context Management**:  
  - Create, Save, & Share Custom Presets  
  - Switch between AI Endpoints and Presets mid-chat
  - Edit, Resubmit, and Continue Messages with Conversation branching  
  - Create and share prompts with specific users and groups
  - [Fork Messages & Conversations](https://www.librechat.ai/docs/features/fork) for Advanced Context control

- 💬 **Multimodal & File Interactions**:  
  - Upload and analyze images with Claude 3, GPT-4.5, GPT-4o, o1, Llama-Vision, and Gemini 📸  
  - Chat with Files using Custom Endpoints, OpenAI, Azure, Anthropic, AWS Bedrock, & Google 🗃️

- 🌎 **Multilingual UI**:
  - English, 中文 (简体), 中文 (繁體), العربية, Deutsch, Español, Français, Italiano
  - Polski, Português (PT), Português (BR), Русский, 日本語, Svenska, 한국어, Tiếng Việt
  - Türkçe, Nederlands, עברית, Català, Čeština, Dansk, Eesti, فارسی
  - Suomi, Magyar, Հայերեն, Bahasa Indonesia, ქართული, Latviešu, ไทย, ئۇيغۇرچە

- 🧠 **Reasoning UI**:  
  - Dynamic Reasoning UI for Chain-of-Thought/Reasoning AI models like DeepSeek-R1

- 🎨 **Customizable Interface**:  
  - Customizable Dropdown & Interface that adapts to both power users and newcomers

- 🌊 **[Resumable Streams](https://www.librechat.ai/docs/features/resumable_streams)**:  
  - Never lose a response: AI responses automatically reconnect and resume if your connection drops
  - Multi-Tab & Multi-Device Sync: Open the same chat in multiple tabs or pick up on another device
  - Production-Ready: Works from single-server setups to horizontally scaled deployments with Redis

- 🗣️ **Speech & Audio**:  
  - Chat hands-free with Speech-to-Text and Text-to-Speech  
  - Automatically send and play Audio  
  - Supports OpenAI, Azure OpenAI, and Elevenlabs

- 📥 **Import & Export Conversations**:  
  - Import Conversations from LibreChat, ChatGPT, Chatbot UI  
  - Export conversations as screenshots, markdown, text, json

- 🔍 **Search & Discovery**:  
  - Search all messages/conversations

- 👥 **Multi-User & Secure Access**:
  - Multi-User, Secure Authentication with OAuth2, LDAP, & Email Login Support
  - Built-in Moderation, and Token spend tools

- ⚙️ **Configuration & Deployment**:  
  - Configure Proxy, Reverse Proxy, Docker, & many Deployment options  
  - Use [S3 with CloudFront](https://www.librechat.ai/docs/configuration/cdn/cloudfront) for stable media links, edge delivery, signed cookies, and secured downloads
  - Use completely local or deploy on the cloud

- 📖 **Open-Source & Community**:  
  - Completely Open-Source & Built in Public  
  - Community-driven development, support, and feedback

[For a thorough review of our features, see our docs here](https://docs.librechat.ai/) 📚

## 🪶 All-In-One AI Conversations with LibreChat

LibreChat is a self-hosted AI chat platform that unifies all major AI providers in a single, privacy-focused interface.

Beyond chat, LibreChat provides AI Agents, Model Context Protocol (MCP) support, Artifacts, Code Interpreter, custom actions, conversation search, and enterprise-ready multi-user authentication.

Open source, actively developed, and built for anyone who values control over their AI infrastructure.

---

## 🌐 Resources

**GitHub Repo:**
  - **RAG API:** [github.com/danny-avila/rag_api](https://github.com/danny-avila/rag_api)
  - **Website:** [github.com/LibreChat-AI/librechat.ai](https://github.com/LibreChat-AI/librechat.ai)

**Other:**
  - **Website:** [librechat.ai](https://librechat.ai)
  - **Documentation:** [librechat.ai/docs](https://librechat.ai/docs)
  - **Blog:** [librechat.ai/blog](https://librechat.ai/blog)

---

## 📝 Changelog

Keep up with the latest updates by visiting the releases page and notes:
- [Releases](https://github.com/danny-avila/LibreChat/releases)
- [Changelog](https://www.librechat.ai/changelog) 

**⚠️ Please consult the [changelog](https://www.librechat.ai/changelog) for breaking changes before updating.**

---

## ⭐ Star History

<p align="center">
  <a href="https://star-history.com/#danny-avila/LibreChat&Date">
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=danny-avila/LibreChat&type=Date&theme=dark" onerror="this.src='https://api.star-history.com/svg?repos=danny-avila/LibreChat&type=Date'" />
  </a>
</p>
<p align="center">
  <a href="https://trendshift.io/repositories/4685" target="_blank" style="padding: 10px;">
    <img src="https://trendshift.io/api/badge/repositories/4685" alt="danny-avila%2FLibreChat | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <a href="https://runacap.com/ross-index/q1-24/" target="_blank" rel="noopener" style="margin-left: 20px;">
    <img style="width: 260px; height: 56px" src="https://runacap.com/wp-content/uploads/2024/04/ROSS_badge_white_Q1_2024.svg" alt="ROSS Index - Fastest Growing Open-Source Startups in Q1 2024 | Runa Capital" width="260" height="56"/>
  </a>
</p>

---

## ✨ Contributions

Contributions, suggestions, bug reports and fixes are welcome!

For new features, components, or extensions, please open an issue and discuss before sending a PR.

If you'd like to help translate LibreChat into your language, we'd love your contribution! Improving our translations not only makes LibreChat more accessible to users around the world but also enhances the overall user experience. Please check out our [Translation Guide](https://www.librechat.ai/docs/translation).

---

## 💖 This project exists in its current state thanks to all the people who contribute

<a href="https://github.com/danny-avila/LibreChat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=danny-avila/LibreChat" />
</a>

---

## 🎉 Special Thanks

We thank [Locize](https://locize.com) for their translation management tools that support multiple languages in LibreChat.

<p align="center">
  <a href="https://locize.com" target="_blank" rel="noopener noreferrer">
    <img src="https://github.com/user-attachments/assets/d6b70894-6064-475e-bb65-92a9e23e0077" alt="Locize Logo" height="50">
  </a>
</p>
